/**
 * Mythic Life — Layer 0 Pure Core
 *
 * Single boundary for all foundational scoring.
 * Later layers must consume these results; they must not re-implement them.
 *
 * Pure functions only. No I/O, no narrative, no party doctrine.
 */

import type {
  LifeDomain,
  DualTrackTotals,
  MultiplierStack,
  SelfNeglectResult,
} from './types'
import { detectSelfNeglect, debtToMultiplier } from './ontology'
import type { RhythmTier } from './relationship'
import {
  type RhythmDay,
  rhythmDayToTier,
  finalizedTiersFromDays,
  DEFAULT_RHYTHM_CONFIG,
} from './health-sync'

// ─── Re-exports of canonical Layer 0 pieces ───────────────────────────────

export type { LifeDomain, DualTrackTotals, MultiplierStack, SelfNeglectResult }
export type { RhythmTier }
export type { RhythmDay }
export { detectSelfNeglect, debtToMultiplier }
export { rhythmDayToTier, finalizedTiersFromDays, DEFAULT_RHYTHM_CONFIG }

// ─── Shadow Debt ──────────────────────────────────────────────────────────

export interface ShadowDebtState {
  /** Current debt points (0+). Higher = more drag. */
  current: number
  /** Lifetime accumulated (for history / UI later). */
  lifetime: number
  /** Lifetime burned. */
  burned: number
}

export function createEmptyDebt(): ShadowDebtState {
  return { current: 0, lifetime: 0, burned: 0 }
}

/**
 * Accumulate debt from a failure event.
 * weight is typically recommendedDebtWeight from SelfNeglect or a fixed penalty.
 */
export function accumulateShadowDebt(
  state: ShadowDebtState,
  weight: number
): ShadowDebtState {
  const add = Math.max(0, weight)
  return {
    current: state.current + add,
    lifetime: state.lifetime + add,
    burned: state.burned,
  }
}

/**
 * Burn debt via a recovery action.
 * amount is how many points to remove (clamped to current).
 */
export function burnShadowDebt(
  state: ShadowDebtState,
  amount: number
): ShadowDebtState {
  const burn = Math.min(state.current, Math.max(0, amount))
  return {
    current: state.current - burn,
    lifetime: state.lifetime,
    burned: state.burned + burn,
  }
}

/** Multiplier from current debt. Floor at 0.6. */
export function shadowDebtMultiplier(currentDebt: number): number {
  return debtToMultiplier(currentDebt)
}

// ─── Consistency Tokens ───────────────────────────────────────────────────

export interface TokenGateInput {
  /** Weighted task score for the day (from ontology aggregates). */
  taskScore: number
  /** Finalized Rhythm tier for the night that feeds this day. */
  rhythmTier: RhythmTier
  /** Minimum task score required before any tokens can be earned. */
  taskFloor?: number
}

/** Full union coverage — primary names + sandbox aliases */
const TIER_TOKEN_FACTOR: Record<RhythmTier, number> = {
  Excellent: 1.35,
  Elite: 1.35,
  Good: 1.15,
  Strong: 1.15,
  Neutral: 1.0,
  Steady: 1.0,
  Poor: 0.55,
  Fragile: 0.55,
  Bad: 0.2,
  Broken: 0.2,
}

/**
 * Pure token calculation.
 * Tokens are gated: both task performance and Rhythm must clear thresholds.
 * Bad / Poor rhythm heavily suppresses earnings even if tasks were strong.
 */
export function earnConsistencyTokens(input: TokenGateInput): number {
  const floor = input.taskFloor ?? 40
  if (input.taskScore < floor) return 0

  const factor = TIER_TOKEN_FACTOR[input.rhythmTier] ?? 1
  // Base: roughly 1 token per 25 points of weighted score, scaled by rhythm
  const raw = (input.taskScore / 25) * factor
  return Math.max(0, Math.round(raw * 10) / 10)
}

// ─── Truth Multiplier ─────────────────────────────────────────────────────

export interface TruthState {
  /** 1.0 = unaudited self-report. Higher only from external verification. */
  multiplier: number
  /** Optional label for UI / logs ("healthkit", "manual-audit", etc.). */
  source?: string
  /** When the current multiplier was last raised. */
  verifiedAt?: string
}

export function createDefaultTruth(): TruthState {
  return { multiplier: 1.0 }
}

/**
 * Raise or set the Truth Multiplier.
 * Never call this from pure self-report paths.
 */
export function applyTruthMultiplier(
  prev: TruthState,
  nextMultiplier: number,
  source: string,
  at: Date = new Date()
): TruthState {
  const clamped = Math.max(1.0, Math.min(1.5, nextMultiplier))
  return {
    multiplier: clamped,
    source,
    verifiedAt: at.toISOString(),
  }
}

// ─── Combined Multiplier Stack ────────────────────────────────────────────

export interface MultiplierInput {
  rhythmTier: RhythmTier
  truth: number
  shadowDebt: number
  selfNeglect: number
}

const RHYTHM_MULT: Record<RhythmTier, number> = {
  Excellent: 1.25,
  Elite: 1.25,
  Good: 1.1,
  Strong: 1.1,
  Neutral: 1.0,
  Steady: 1.0,
  Poor: 0.85,
  Fragile: 0.85,
  Bad: 0.65,
  Broken: 0.65,
}

/**
 * Build the final multiplier stack that reward systems must use.
 */
export function buildMultiplierStack(input: MultiplierInput): MultiplierStack {
  const rhythm = RHYTHM_MULT[input.rhythmTier] ?? 1
  const truth = Math.max(1, input.truth)
  const shadowDebt = shadowDebtMultiplier(input.shadowDebt)
  const selfNeglect = Math.max(0.6, Math.min(1, input.selfNeglect))

  const combined = Number(
    (rhythm * truth * shadowDebt * selfNeglect).toFixed(4)
  )

  return { rhythm, truth, shadowDebt, selfNeglect, combined }
}

// ─── Basic Leader Trust delta from Rhythm ─────────────────────────────────

/**
 * Pure Trust delta from a finalized Rhythm tier.
 * Relationship engine applies patience modifiers on top of this.
 */
export function rhythmTrustDelta(tier: RhythmTier): number {
  switch (tier) {
    case 'Excellent':
    case 'Elite':
      return 10
    case 'Good':
    case 'Strong':
      return 5
    case 'Neutral':
    case 'Steady':
      return 1.5
    case 'Poor':
    case 'Fragile':
      return -4
    case 'Bad':
    case 'Broken':
      return -10
    default:
      return 0
  }
}

// ─── Daily evaluation (single roll-up) ─────────────────────────────────────

export interface DayEvalInput {
  /** Finalized Rhythm day (or null if none). */
  rhythmDay: RhythmDay | null
  /** Domain aggregates for the day (from ontology). */
  domainAggregates: Record<LifeDomain, number>
  /** Current Shadow Debt state. */
  debt: ShadowDebtState
  /** Current Truth state. */
  truth: TruthState
}

export interface DayEvalResult {
  rhythmTier: RhythmTier
  selfNeglect: SelfNeglectResult
  tokensEarned: number
  debt: ShadowDebtState
  multipliers: MultiplierStack
  trustDelta: number
  dualTrack: DualTrackTotals
}

/**
 * Single pure daily evaluation.
 * Later layers call this, then persist and react.
 */
export function evaluateDay(input: DayEvalInput): DayEvalResult {
  const rhythmTier: RhythmTier = input.rhythmDay
    ? rhythmDayToTier(input.rhythmDay)
    : 'Neutral'

  const selfNeglect = detectSelfNeglect(input.domainAggregates)

  // Debt: add recommended weight when self-neglect is present
  let debt = input.debt
  if (selfNeglect.recommendedDebtWeight > 0) {
    debt = accumulateShadowDebt(debt, selfNeglect.recommendedDebtWeight)
  }

  // Severe rhythm also adds a small debt hit
  if (rhythmTier === 'Bad' || rhythmTier === 'Broken') {
    debt = accumulateShadowDebt(debt, 4)
  } else if (rhythmTier === 'Poor' || rhythmTier === 'Fragile') {
    debt = accumulateShadowDebt(debt, 2)
  }

  const taskScore = Object.values(input.domainAggregates).reduce(
    (a, b) => a + b,
    0
  )

  const tokensEarned = earnConsistencyTokens({
    taskScore,
    rhythmTier,
  })

  const multipliers = buildMultiplierStack({
    rhythmTier,
    truth: input.truth.multiplier,
    shadowDebt: debt.current,
    selfNeglect: selfNeglect.selfMultiplier,
  })

  const trustDelta = rhythmTrustDelta(rhythmTier)

  // Simple dual-track: XP/Gold scale with task score × combined multiplier
  const base = taskScore * multipliers.combined
  const dualTrack: DualTrackTotals = {
    xp: Math.round(base),
    gold: Math.round(base * 0.35),
    tokens: tokensEarned,
  }

  return {
    rhythmTier,
    selfNeglect,
    tokensEarned,
    debt,
    multipliers,
    trustDelta,
    dualTrack,
  }
}
