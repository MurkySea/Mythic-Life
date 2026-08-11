import type { MomentumBand } from './types'

export const MOMENTUM_CONFIG = {
  completionGain: 12,
  returnWithinTwoDaysBonus: 8,
  dailySoftDecay: 4,
  graceDays: 1,
  thresholds: [0, 12, 28, 48, 70, 90] as const,
}

export type MomentumState = {
  score: number
  band: MomentumBand
  lastActionAt: string | null
}

const BANDS: MomentumBand[] = [
  'Dormant',
  'Stirring',
  'Building',
  'Momentum',
  'Flow',
  'Ascendant',
]

export function momentumBand(score: number): MomentumBand {
  const value = Math.max(0, Math.min(100, score))
  let index = 0
  for (let i = 0; i < MOMENTUM_CONFIG.thresholds.length; i += 1) {
    if (value >= MOMENTUM_CONFIG.thresholds[i]) index = i
  }
  return BANDS[index]
}

export function advanceMomentum(
  previous: MomentumState,
  completedAt: Date,
): MomentumState {
  const priorAt = previous.lastActionAt ? new Date(previous.lastActionAt) : null
  const daysSince = priorAt
    ? Math.max(0, (completedAt.getTime() - priorAt.getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY
  const missedDays = Number.isFinite(daysSince)
    ? Math.max(0, Math.floor(daysSince) - MOMENTUM_CONFIG.graceDays)
    : 0
  const decayed = Math.max(
    0,
    previous.score - missedDays * MOMENTUM_CONFIG.dailySoftDecay,
  )
  const returnBonus = daysSince > 1 && daysSince <= 3
    ? MOMENTUM_CONFIG.returnWithinTwoDaysBonus
    : 0
  const score = Math.min(
    100,
    decayed + MOMENTUM_CONFIG.completionGain + returnBonus,
  )

  return {
    score,
    band: momentumBand(score),
    lastActionAt: completedAt.toISOString(),
  }
}
