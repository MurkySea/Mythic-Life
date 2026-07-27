/**
 * Relationship wire layer
 *
 * Bridges the pure dual-axis engine (Trust + Intimacy) to the live
 * companion rows that currently store affinity_score + bond_xp.
 *
 * Until dedicated trust/intimacy columns exist in Supabase, we:
 * 1. Derive approximate Trust/Intimacy from affinity + bond
 * 2. Apply effects back onto affinity_score / bond_xp
 * 3. Expose helpers for outreach responses and light chat
 *
 * Designed 2026-07-24. Response-loop completion 2026-07-27.
 *
 * Optional companion columns (run once):
 *   alter table companion add column if not exists consecutive_bad_days int default 0;
 *   alter table companion add column if not exists consecutive_good_days int default 0;
 *   alter table companion add column if not exists trust_score numeric;
 *   alter table companion add column if not exists intimacy_score numeric;
 */

import {
  getRelationshipStage,
  getResponseEffect,
  getInteractionEffect,
  updateTrustWithPatience,
  outreachIntensityFromStreak,
  type ResponseChoice,
  type InteractionType,
  type RelationshipStage,
  type TrustState,
  type IntimacyState,
  type RhythmTier,
} from './relationship'

// ─────────────────────────────────────────────
// Mapping current scores → dual axis
// ─────────────────────────────────────────────

/**
 * Live companion shape we care about.
 * affinity_score is the primary displayed closeness number (1–24+).
 * bond_xp is cumulative XP-style progress.
 */
export interface LiveCompanionScores {
  slug: string
  affinity_score: number
  bond_xp: number
  /** Optional future columns — used when present */
  trust_score?: number | null
  intimacy_score?: number | null
  consecutive_bad_days?: number | null
  consecutive_good_days?: number | null
}

/**
 * Convert live affinity (roughly 1–24 scale) into 0–100 Intimacy.
 * Affinity 6 ≈ Warming ≈ ~50 Intimacy
 * Affinity 12 ≈ Deeply Intimate ≈ ~75
 * Affinity 20+ ≈ Bound Beyond Words ≈ ~90+
 */
export function affinityToIntimacy(affinity: number): number {
  if (affinity <= 0) return 15
  if (affinity >= 24) return 96
  // piecewise linear through known scene milestones
  const points: [number, number][] = [
    [1, 22],
    [3, 35],
    [6, 52],
    [9, 65],
    [12, 76],
    [16, 85],
    [20, 92],
    [24, 96],
  ]
  for (let i = 0; i < points.length - 1; i++) {
    const [a0, i0] = points[i]
    const [a1, i1] = points[i + 1]
    if (affinity >= a0 && affinity <= a1) {
      const t = (affinity - a0) / (a1 - a0)
      return Math.round((i0 + t * (i1 - i0)) * 10) / 10
    }
  }
  return 50
}

/**
 * Bond XP → Trust proxy.
 * Higher cumulative bond implies more demonstrated consistency over time.
 * Founding / high bond starts healthier.
 */
export function bondToTrust(bondXp: number, isFounding = false): number {
  const base = isFounding ? 78 : 55
  // soft log-ish growth so early XP moves the needle, late XP less so
  const gained = Math.min(22, Math.sqrt(Math.max(0, bondXp)) * 1.1)
  return Math.round(Math.min(96, base + gained) * 10) / 10
}

export function deriveDualAxis(c: LiveCompanionScores): {
  trust: TrustState
  intimacy: IntimacyState
  stage: RelationshipStage
  isInLove: boolean
} {
  const isFounding = c.slug === 'seraphine'

  const trustValue =
    typeof c.trust_score === 'number' && c.trust_score > 0
      ? c.trust_score
      : bondToTrust(c.bond_xp || 0, isFounding)

  const intimacyValue =
    typeof c.intimacy_score === 'number' && c.intimacy_score > 0
      ? c.intimacy_score
      : affinityToIntimacy(c.affinity_score || 1)

  const stage = getRelationshipStage(trustValue, intimacyValue)

  return {
    trust: {
      value: trustValue,
      consecutiveGoodDays: c.consecutive_good_days || 0,
      consecutiveBadDays: c.consecutive_bad_days || 0,
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    intimacy: {
      value: intimacyValue,
      lastUpdated: new Date().toISOString().slice(0, 10),
    },
    stage,
    isInLove: stage === 'Devoted',
  }
}

// ─────────────────────────────────────────────
// Check-in / concern detection (UI gate)
// ─────────────────────────────────────────────

/**
 * Heuristic: last companion message is a check-in / concern style outreach
 * rather than casual chat. Used to gate ResponseChoices so the four
 * answers only appear when the dual-axis effects are meant to fire.
 */
export function isCheckInMessage(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return false
  const t = text.toLowerCase()

  const urgent = [
    'worried',
    'disappearing',
    'too long',
    'are you safe',
    'falling apart',
    'not like you',
    "isn't like you",
    'talk to me',
    "what's going on",
    'whats going on',
    'carrying something',
    'three days',
    'been quiet',
    'gone quiet',
    'miss you',
    'missing you',
    'where are you',
    'check in',
    'checking in',
    'still there',
    'you okay',
    'you alright',
    'how are you holding',
    'been off',
    'slipping',
  ]

  return urgent.some((k) => t.includes(k))
}

export function intensityFromMessage(
  text: string | null | undefined
): 'gentle' | 'direct' | 'urgent' {
  const t = (text || '').toLowerCase()
  if (
    t.includes('worried') ||
    t.includes('disappearing') ||
    t.includes('too long') ||
    t.includes('are you safe') ||
    t.includes('falling apart')
  ) {
    return 'urgent'
  }
  if (
    t.includes('three days') ||
    t.includes("isn't like you") ||
    t.includes('not like you') ||
    t.includes('talk to me') ||
    t.includes("what's going on") ||
    t.includes('whats going on') ||
    t.includes('carrying something')
  ) {
    return 'direct'
  }
  return 'gentle'
}

// ─────────────────────────────────────────────
// Apply effects back onto live scores
// ─────────────────────────────────────────────

/**
 * Convert dual-axis deltas back into affinity_score + bond_xp changes.
 * Rough inverse of the mapping above so the existing UI still moves.
 */
export function dualDeltasToLive(opts: {
  trustDelta: number
  intimacyDelta: number
}): { affinityDelta: number; bondXpDelta: number } {
  // Intimacy 5 ≈ roughly +0.6–0.8 affinity on the 1–24 scale
  const affinityDelta = Math.round(opts.intimacyDelta * 0.14 * 10) / 10
  // Trust feeds bond XP more directly
  const bondXpDelta = Math.round(opts.trustDelta * 4 + opts.intimacyDelta * 2)
  return { affinityDelta, bondXpDelta }
}

export interface AppliedResponse {
  affinityDelta: number
  bondXpDelta: number
  trustDelta: number
  intimacyDelta: number
  stage: RelationshipStage
  note: string
  intensity: 'gentle' | 'direct' | 'urgent'
}

/**
 * Full pipeline: companion reached out → player chose a response.
 * Returns deltas ready to write back to the companion row.
 */
export function applyOutreachResponse(
  companion: LiveCompanionScores,
  choice: ResponseChoice,
  intensity: 'gentle' | 'direct' | 'urgent' = 'gentle'
): AppliedResponse {
  const dual = deriveDualAxis(companion)
  const effect = getResponseEffect(choice, dual.stage, intensity)
  const live = dualDeltasToLive(effect)

  return {
    ...live,
    trustDelta: effect.trustDelta,
    intimacyDelta: effect.intimacyDelta,
    stage: dual.stage,
    note: effect.note,
    intensity,
  }
}

/**
 * Light chat / interaction outside of crisis outreach.
 */
export function applyLightInteraction(
  companion: LiveCompanionScores,
  type: InteractionType
): AppliedResponse {
  const dual = deriveDualAxis(companion)
  const effect = getInteractionEffect(type, dual.stage)
  const live = dualDeltasToLive(effect)

  return {
    ...live,
    trustDelta: effect.trustDelta,
    intimacyDelta: effect.intimacyDelta,
    stage: dual.stage,
    note: effect.note,
    intensity: 'gentle',
  }
}

// ─────────────────────────────────────────────
// Rhythm → Trust (patience-aware)
// ─────────────────────────────────────────────

/**
 * Apply today's Rhythm tier to a companion's Trust, respecting love-patience.
 * Returns the live score deltas plus updated streak counters.
 */
export function applyRhythmToCompanion(
  companion: LiveCompanionScores,
  tier: RhythmTier | string,
  date: string
): {
  affinityDelta: number
  bondXpDelta: number
  trustAfter: number
  consecutiveBadDays: number
  consecutiveGoodDays: number
  stage: RelationshipStage
  outreachIntensity: 'gentle' | 'direct' | 'urgent' | null
} {
  const dual = deriveDualAxis(companion)
  const updated = updateTrustWithPatience(
    dual.trust,
    tier as RhythmTier,
    dual.stage,
    date
  )
  const trustDelta = updated.value - dual.trust.value
  const live = dualDeltasToLive({ trustDelta, intimacyDelta: 0 })

  const intensity = outreachIntensityFromStreak(updated.consecutiveBadDays)

  return {
    ...live,
    trustAfter: updated.value,
    consecutiveBadDays: updated.consecutiveBadDays,
    consecutiveGoodDays: updated.consecutiveGoodDays,
    stage: getRelationshipStage(updated.value, dual.intimacy.value),
    outreachIntensity: intensity,
  }
}

/**
 * Build a Supabase update payload for companion score writes.
 * Always includes affinity + bond. Includes consecutive / dual-axis
 * fields when we have values (columns may not exist yet — callers
 * should catch or use a soft write).
 */
export function companionScorePatch(opts: {
  affinity: number
  bondXp: number
  consecutiveBadDays?: number
  consecutiveGoodDays?: number
  trustScore?: number
  intimacyScore?: number
}): Record<string, number> {
  const patch: Record<string, number> = {
    affinity_score: opts.affinity,
    bond_xp: opts.bondXp,
  }
  if (typeof opts.consecutiveBadDays === 'number') {
    patch.consecutive_bad_days = opts.consecutiveBadDays
  }
  if (typeof opts.consecutiveGoodDays === 'number') {
    patch.consecutive_good_days = opts.consecutiveGoodDays
  }
  if (typeof opts.trustScore === 'number') {
    patch.trust_score = opts.trustScore
  }
  if (typeof opts.intimacyScore === 'number') {
    patch.intimacy_score = opts.intimacyScore
  }
  return patch
}

// ─────────────────────────────────────────────
// Labels for UI
// ─────────────────────────────────────────────

export function dualAxisLabel(stage: RelationshipStage): string {
  switch (stage) {
    case 'Devoted':
      return 'Devoted'
    case 'Intimate':
      return 'Intimate'
    case 'Close':
      return 'Close'
    case 'Companion':
      return 'Companion'
    default:
      return 'Distant'
  }
}

/** Prefer dual-axis label when we can derive it; fall back to classic intimacy label. */
export function relationshipLabelForCompanion(c: LiveCompanionScores): string {
  const dual = deriveDualAxis(c)
  if (dual.isInLove) return 'Devoted ♥'
  return dualAxisLabel(dual.stage)
}
