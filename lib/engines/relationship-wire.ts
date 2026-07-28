/**
 * Relationship wire layer
 *
 * Bridges the pure dual-axis engine (Trust + Intimacy) to live companion rows.
 *
 * Primary store (2026-07-27):
 *   trust_score, intimacy_score, consecutive_bad/good_days
 * Mirror (legacy UI):
 *   affinity_score, bond_xp — still updated so scenes / profile keep moving
 *
 * deriveDualAxis prefers stored dual-axis values; falls back to affinity/bond
 * mapping only when columns are null (pre-backfill rows).
 *
 * Companion columns (run once):
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

export interface LiveCompanionScores {
  slug: string
  affinity_score: number
  bond_xp: number
  trust_score?: number | null
  intimacy_score?: number | null
  consecutive_bad_days?: number | null
  consecutive_good_days?: number | null
}

/**
 * Convert live affinity (roughly 1–24 scale) into 0–100 Intimacy.
 */
export function affinityToIntimacy(affinity: number): number {
  if (affinity <= 0) return 15
  if (affinity >= 24) return 96
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
 */
export function bondToTrust(bondXp: number, isFounding = false): number {
  const base = isFounding ? 78 : 55
  const gained = Math.min(22, Math.sqrt(Math.max(0, bondXp)) * 1.1)
  return Math.round(Math.min(96, base + gained) * 10) / 10
}

/**
 * Resolve dual-axis values.
 * Stored trust_score / intimacy_score are primary when present (> 0).
 * Otherwise derive from bond / affinity (backfill path).
 */
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

/**
 * Pure backfill values for one companion.
 * Always derives from affinity/bond (ignores existing dual-axis so you can re-run).
 * Use force=false path in the server action to skip rows that already have scores.
 */
export function backfillScoresFromAffinity(c: {
  slug: string
  affinity_score: number
  bond_xp: number
}): { trust: number; intimacy: number; stage: RelationshipStage } {
  const isFounding = c.slug === 'seraphine'
  const trust = bondToTrust(c.bond_xp || 0, isFounding)
  const intimacy = affinityToIntimacy(c.affinity_score || 1)
  return {
    trust,
    intimacy,
    stage: getRelationshipStage(trust, intimacy),
  }
}

// ─────────────────────────────────────────────
// Check-in / concern detection (UI gate)
// ─────────────────────────────────────────────

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

export function dualDeltasToLive(opts: {
  trustDelta: number
  intimacyDelta: number
}): { affinityDelta: number; bondXpDelta: number } {
  const affinityDelta = Math.round(opts.intimacyDelta * 0.14 * 10) / 10
  const bondXpDelta = Math.round(opts.trustDelta * 4 + opts.intimacyDelta * 2)
  return { affinityDelta, bondXpDelta }
}

export interface AppliedResponse {
  affinityDelta: number
  bondXpDelta: number
  trustDelta: number
  intimacyDelta: number
  /** Absolute next dual-axis values (primary write) */
  trustAfter: number
  intimacyAfter: number
  stage: RelationshipStage
  note: string
  intensity: 'gentle' | 'direct' | 'urgent'
}

function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)) * 10) / 10
}

/**
 * Full pipeline: companion reached out → player chose a response.
 */
export function applyOutreachResponse(
  companion: LiveCompanionScores,
  choice: ResponseChoice,
  intensity: 'gentle' | 'direct' | 'urgent' = 'gentle'
): AppliedResponse {
  const dual = deriveDualAxis(companion)
  const effect = getResponseEffect(choice, dual.stage, intensity)
  const live = dualDeltasToLive(effect)
  const trustAfter = clampScore(dual.trust.value + effect.trustDelta)
  const intimacyAfter = clampScore(dual.intimacy.value + effect.intimacyDelta)

  return {
    ...live,
    trustDelta: effect.trustDelta,
    intimacyDelta: effect.intimacyDelta,
    trustAfter,
    intimacyAfter,
    stage: getRelationshipStage(trustAfter, intimacyAfter),
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
  const trustAfter = clampScore(dual.trust.value + effect.trustDelta)
  const intimacyAfter = clampScore(dual.intimacy.value + effect.intimacyDelta)

  return {
    ...live,
    trustDelta: effect.trustDelta,
    intimacyDelta: effect.intimacyDelta,
    trustAfter,
    intimacyAfter,
    stage: getRelationshipStage(trustAfter, intimacyAfter),
    note: effect.note,
    intensity: 'gentle',
  }
}

// ─────────────────────────────────────────────
// Rhythm → Trust (patience-aware)
// ─────────────────────────────────────────────

export function applyRhythmToCompanion(
  companion: LiveCompanionScores,
  tier: RhythmTier | string,
  date: string
): {
  affinityDelta: number
  bondXpDelta: number
  trustAfter: number
  intimacyAfter: number
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
  const intimacyAfter = dual.intimacy.value

  return {
    ...live,
    trustAfter: updated.value,
    intimacyAfter,
    consecutiveBadDays: updated.consecutiveBadDays,
    consecutiveGoodDays: updated.consecutiveGoodDays,
    stage: getRelationshipStage(updated.value, intimacyAfter),
    outreachIntensity: intensity,
  }
}

/**
 * Supabase update payload.
 * Dual-axis fields are included whenever provided (primary write).
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

export function relationshipLabelForCompanion(c: LiveCompanionScores): string {
  const dual = deriveDualAxis(c)
  if (dual.isInLove) return 'Devoted ♥'
  return dualAxisLabel(dual.stage)
}
