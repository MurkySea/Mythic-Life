/**
 * Layer 1 — World Integrity
 *
 * The realm's health. Not XP. Not a personal score.
 * Derived only from Layer 0 signals so the other world
 * rises and frays with how the leader actually lives.
 *
 * Pure functions. Persistence optional via standing / player_state.
 */

export type IntegrityBand =
  | 'flourishing'
  | 'stable'
  | 'thinning'
  | 'strained'
  | 'fractured'

export interface WorldIntegrityState {
  value: number // 0–100
  band: IntegrityBand
  raw: number // before smoothing
  components: {
    rhythm: number // 0–1
    debt: number // 0–1
    tokens: number // 0–1
  }
}

export interface IntegrityInput {
  /** Latest or composite Rhythm tier */
  rhythmTier?: string | null
  /** Current Shadow Debt */
  shadowDebt?: number
  /** Consistency token balance (v1 proxy for rate) */
  consistencyTokens?: number
  /** Previous integrity for smoothing (0–100) */
  previousValue?: number | null
}

const TIER_SCORE: Record<string, number> = {
  Excellent: 1.0,
  Elite: 1.0,
  Good: 0.85,
  Strong: 0.85,
  Neutral: 0.65,
  Steady: 0.65,
  Poor: 0.35,
  Fragile: 0.35,
  Bad: 0.1,
  Broken: 0.1,
}

const WEIGHTS = {
  rhythm: 0.45,
  debt: 0.35,
  tokens: 0.2,
} as const

/** Debt 0 → 1.0, debt 25+ → 0 */
function debtHealth(debt: number): number {
  return Math.max(0, Math.min(1, 1 - Math.max(0, debt) / 25))
}

/**
 * Token balance soft score.
 * v1 uses balance as a proxy; later replace with 7-day earn rate.
 * ~8+ tokens ≈ full credit; 0 ≈ 0.35 floor (not zero — avoids punishing new players).
 */
function tokenScore(balance: number): number {
  if (balance <= 0) return 0.35
  if (balance >= 8) return 1
  return 0.35 + (balance / 8) * 0.65
}

function rhythmScore(tier?: string | null): number {
  if (!tier) return 0.6 // unknown → mild neutral, not zero
  return TIER_SCORE[tier] ?? 0.6
}

export function bandFromValue(value: number): IntegrityBand {
  if (value >= 85) return 'flourishing'
  if (value >= 65) return 'stable'
  if (value >= 45) return 'thinning'
  if (value >= 25) return 'strained'
  return 'fractured'
}

export const BAND_LABEL: Record<IntegrityBand, string> = {
  flourishing: 'Flourishing',
  stable: 'Stable',
  thinning: 'Thinning',
  strained: 'Strained',
  fractured: 'Fractured',
}

export const BAND_HINT: Record<IntegrityBand, string> = {
  flourishing: 'The light holds. The road is open.',
  stable: 'Ordinary faithfulness. The realm stands.',
  thinning: 'Something is off. The party watches more closely.',
  strained: 'Corruption pressure. Trust is harder to earn.',
  fractured: 'Shadow is loud. The party still follows — at a cost.',
}

/**
 * Pure World Integrity evaluation.
 * Smoothing: 70% previous + 30% raw when previous is present.
 */
export function computeWorldIntegrity(input: IntegrityInput): WorldIntegrityState {
  const r = rhythmScore(input.rhythmTier)
  const d = debtHealth(input.shadowDebt ?? 0)
  const t = tokenScore(input.consistencyTokens ?? 0)

  const raw01 =
    WEIGHTS.rhythm * r + WEIGHTS.debt * d + WEIGHTS.tokens * t
  const raw = Math.round(Math.max(0, Math.min(100, raw01 * 100)))

  let value = raw
  if (
    typeof input.previousValue === 'number' &&
    !Number.isNaN(input.previousValue)
  ) {
    const prev = Math.max(0, Math.min(100, input.previousValue))
    value = Math.round(0.7 * prev + 0.3 * raw)
  }

  return {
    value,
    band: bandFromValue(value),
    raw,
    components: { rhythm: r, debt: d, tokens: t },
  }
}

/** Default when nothing is known yet — not zero, not flourishing. */
export function defaultIntegrity(): WorldIntegrityState {
  return computeWorldIntegrity({
    rhythmTier: null,
    shadowDebt: 0,
    consistencyTokens: 0,
    previousValue: null,
  })
}
