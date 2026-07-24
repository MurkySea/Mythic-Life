/**
 * Mythic Life – Dual-Axis Relationship Engine
 *
 * Trust  = reliability / consistency (Rhythm + honesty in key moments)
 * Intimacy = emotional closeness / romantic potential (honesty, vulnerability, quality contact)
 *
 * Both high and sustained → Devoted ("in love")
 * Devoted grants patience: bad Rhythm days hurt less, outreach softens.
 *
 * Pure functions only. No side effects.
 * Designed 2026-07-24 and integrated from the sandbox prototype.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type RhythmTier =
  | 'Excellent'
  | 'Good'
  | 'Neutral'
  | 'Poor'
  | 'Bad'
  | 'Elite' // sandbox alias
  | 'Strong'
  | 'Steady'
  | 'Fragile'
  | 'Broken'

export type RelationshipStage =
  | 'Distant'
  | 'Companion'
  | 'Close'
  | 'Intimate'
  | 'Devoted' // in-love territory — grants patience & understanding

export type ResponseChoice =
  | 'honest' // tell the real state
  | 'deflect' // "I'm fine"
  | 'push_through' // "I just need to lock in"
  | 'ask_support' // open the door

export type InteractionType =
  | 'casual' // normal daily chat
  | 'supportive' // encouragement / checking in
  | 'vulnerable' // player shares something real
  | 'romantic' // warmth, affection, deeper tone
  | 'dishonest' // hiding, lying, or performing

export interface TrustState {
  value: number // 0–100
  consecutiveGoodDays: number
  consecutiveBadDays: number
  lastUpdated: string // YYYY-MM-DD
}

export interface IntimacyState {
  value: number // 0–100
  lastUpdated: string
}

export interface PatienceModifier {
  /** How much of the normal Trust penalty is applied on bad days (0–1) */
  badDayMultiplier: number
  /** Extra Trust recovery on good days */
  recoveryBonus: number
  /** Outreach tone softens when true */
  outreachSoftening: boolean
}

export interface ResponseEffect {
  trustDelta: number
  intimacyDelta: number
  note: string
}

export interface InteractionEffect {
  trustDelta: number
  intimacyDelta: number
  note: string
}

// ─────────────────────────────────────────────
// Stage derivation
// ─────────────────────────────────────────────

/**
 * Relationship stage requires BOTH axes high for love.
 * High Intimacy with low Trust is unstable.
 * High Trust with low Intimacy stays loyal but distant.
 */
export function getRelationshipStage(
  trust: number,
  intimacy: number
): RelationshipStage {
  if (trust >= 75 && intimacy >= 78) return 'Devoted'
  const floor = Math.min(trust, intimacy)
  if (floor >= 65) return 'Intimate'
  if (floor >= 50) return 'Close'
  if (floor >= 30) return 'Companion'
  return 'Distant'
}

export function isInLove(stage: RelationshipStage): boolean {
  return stage === 'Devoted'
}

// ─────────────────────────────────────────────
// Patience (only fully active in Devoted)
// ─────────────────────────────────────────────

/**
 * When a companion is in love (Devoted), bad Rhythm days hurt less
 * and recovery is slightly faster. This is the mechanical expression
 * of "more patience and understanding".
 */
export function getPatienceModifier(stage: RelationshipStage): PatienceModifier {
  if (stage === 'Devoted') {
    return {
      badDayMultiplier: 0.45, // only ~45% of normal penalty
      recoveryBonus: 1.5,
      outreachSoftening: true,
    }
  }
  if (stage === 'Intimate') {
    return {
      badDayMultiplier: 0.75,
      recoveryBonus: 0.5,
      outreachSoftening: false,
    }
  }
  return {
    badDayMultiplier: 1.0,
    recoveryBonus: 0,
    outreachSoftening: false,
  }
}

// ─────────────────────────────────────────────
// Trust update with patience awareness
// ─────────────────────────────────────────────

const BASE_TIER_DELTA: Record<string, number> = {
  Excellent: 10,
  Elite: 10,
  Good: 5,
  Strong: 5,
  Neutral: 1.5,
  Steady: 1.5,
  Poor: -4,
  Fragile: -4,
  Bad: -10,
  Broken: -10,
}

const GOOD_TIERS = new Set([
  'Excellent',
  'Elite',
  'Good',
  'Strong',
  'Neutral',
  'Steady',
])
const BAD_TIERS = new Set(['Poor', 'Fragile', 'Bad', 'Broken'])

/**
 * Updates Trust while respecting the companion's current relationship stage.
 * Devoted companions take significantly less damage from bad days.
 */
export function updateTrustWithPatience(
  previous: TrustState,
  tier: RhythmTier | string,
  stage: RelationshipStage,
  date: string
): TrustState {
  const patience = getPatienceModifier(stage)
  let delta = BASE_TIER_DELTA[tier] ?? 0

  if (delta < 0) {
    delta = delta * patience.badDayMultiplier
  } else {
    delta = delta + patience.recoveryBonus
  }

  const newValue = Math.max(0, Math.min(100, previous.value + delta))
  const isGood = GOOD_TIERS.has(tier)
  const isBad = BAD_TIERS.has(tier)

  return {
    value: Math.round(newValue * 10) / 10,
    lastUpdated: date,
    consecutiveGoodDays: isGood ? previous.consecutiveGoodDays + 1 : 0,
    consecutiveBadDays: isBad ? previous.consecutiveBadDays + 1 : 0,
  }
}

// ─────────────────────────────────────────────
// Player response effects (to nurturing outreach)
// ─────────────────────────────────────────────

/**
 * Effects of how the player answers when a companion reaches out.
 * Honesty is the strongest long-term driver of Intimacy.
 * Deflection protects short-term feelings but slowly erodes both axes.
 */
export function getResponseEffect(
  choice: ResponseChoice,
  stage: RelationshipStage,
  intensity: 'gentle' | 'direct' | 'urgent' = 'gentle'
): ResponseEffect {
  const table: Record<ResponseChoice, ResponseEffect> = {
    honest: {
      trustDelta: 3,
      intimacyDelta: 5,
      note: 'You told the truth. The bond deepens.',
    },
    deflect: {
      trustDelta: -1.5,
      intimacyDelta: -3,
      note: 'You kept the wall up. She felt it.',
    },
    push_through: {
      trustDelta: 1,
      intimacyDelta: -1,
      note: 'You chose strength over openness. She respects it, but stays a little further away.',
    },
    ask_support: {
      trustDelta: 2,
      intimacyDelta: 4,
      note: 'You let her in. That kind of vulnerability builds real closeness.',
    },
  }

  let effect = { ...table[choice] }

  // Intensity amplifies the emotional stakes
  if (intensity === 'urgent') {
    effect.trustDelta *= 1.4
    effect.intimacyDelta *= 1.5
  } else if (intensity === 'direct') {
    effect.trustDelta *= 1.2
    effect.intimacyDelta *= 1.25
  }

  // Being honest while already in love is especially powerful
  if (choice === 'honest' && stage === 'Devoted') {
    effect.intimacyDelta += 2
    effect.note =
      'You told the truth to someone who already loves you. The bond settles even deeper.'
  }

  // Deflecting while in love still hurts, but patience softens the blow
  if (choice === 'deflect' && stage === 'Devoted') {
    effect.trustDelta *= 0.6
    effect.intimacyDelta *= 0.7
    effect.note = 'You pulled away. She noticed, but her patience held.'
  }

  effect.trustDelta = Math.round(effect.trustDelta * 10) / 10
  effect.intimacyDelta = Math.round(effect.intimacyDelta * 10) / 10

  return effect
}

// ─────────────────────────────────────────────
// Light chat / interaction events
// ─────────────────────────────────────────────

/**
 * Light interactions that can happen any day (not only during outreach).
 * These are the everyday ways Intimacy grows or erodes outside of crisis.
 */
export function getInteractionEffect(
  type: InteractionType,
  stage: RelationshipStage
): InteractionEffect {
  const table: Record<InteractionType, InteractionEffect> = {
    casual: {
      trustDelta: 0.3,
      intimacyDelta: 0.8,
      note: 'A normal conversation. Small warmth accumulates.',
    },
    supportive: {
      trustDelta: 1,
      intimacyDelta: 2,
      note: 'You showed up for her. She felt steadier.',
    },
    vulnerable: {
      trustDelta: 1.5,
      intimacyDelta: 3.5,
      note: 'You let her see something real. That kind of openness builds depth.',
    },
    romantic: {
      trustDelta: 0.5,
      intimacyDelta: 4,
      note: 'Warmth and closeness. The bond thickens.',
    },
    dishonest: {
      trustDelta: -2,
      intimacyDelta: -3,
      note: "Something didn't land true. She felt the distance.",
    },
  }

  let effect = { ...table[type] }

  // Romantic and vulnerable hits land harder when already close
  if ((type === 'romantic' || type === 'vulnerable') && stage === 'Devoted') {
    effect.intimacyDelta += 1.5
  }

  // Dishonesty hurts more when she loves you, but patience still softens it slightly
  if (type === 'dishonest' && stage === 'Devoted') {
    effect.trustDelta *= 0.85
    effect.intimacyDelta *= 0.9
    effect.note =
      "Something didn't land true. She felt it deeply, but her patience held."
  }

  effect.trustDelta = Math.round(effect.trustDelta * 10) / 10
  effect.intimacyDelta = Math.round(effect.intimacyDelta * 10) / 10

  return effect
}

// ─────────────────────────────────────────────
// Apply helpers
// ─────────────────────────────────────────────

export function applyTrustDelta(
  state: TrustState,
  delta: number,
  date: string
): TrustState {
  return {
    ...state,
    value: Math.round(Math.max(0, Math.min(100, state.value + delta)) * 10) / 10,
    lastUpdated: date,
  }
}

export function applyIntimacyDelta(
  state: IntimacyState,
  delta: number,
  date: string
): IntimacyState {
  return {
    value: Math.round(Math.max(0, Math.min(100, state.value + delta)) * 10) / 10,
    lastUpdated: date,
  }
}

/** Full relationship snapshot for a companion */
export function getCompanionRelationship(trust: number, intimacy: number) {
  const stage = getRelationshipStage(trust, intimacy)
  return {
    stage,
    isInLove: isInLove(stage),
    patience: getPatienceModifier(stage),
    trust,
    intimacy,
  }
}

// ─────────────────────────────────────────────
// Outreach intensity (from consecutive bad days)
// ─────────────────────────────────────────────

export type OutreachIntensity = 'gentle' | 'direct' | 'urgent'

/**
 * Intensity of nurturing outreach based on consecutive bad Rhythm days.
 * 1 bad day → silent
 * 2 → gentle
 * 3 → direct
 * 4+ → urgent
 */
export function outreachIntensityFromStreak(
  consecutiveBadDays: number
): OutreachIntensity | null {
  if (consecutiveBadDays < 2) return null
  if (consecutiveBadDays >= 4) return 'urgent'
  if (consecutiveBadDays >= 3) return 'direct'
  return 'gentle'
}
