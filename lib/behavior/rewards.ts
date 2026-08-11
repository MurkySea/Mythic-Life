import type { ActivityKind } from './types'

export const REWARD_CONFIG = {
  progressXp: 8,
  ritualCompletionXp: 18,
  questCompletionXp: 36,
  completionGold: 12,
  effortDivisorMinutes: 30,
  maxEffortBonus: 24,
}

export type CompletionReward = {
  xp: number
  gold: number
  completionBonusXp: number
}

export function calculateCompletionReward(input: {
  activityKind: ActivityKind
  effortMinutes: number
  isFinalCompletion: boolean
}): CompletionReward {
  if (!input.isFinalCompletion) {
    return { xp: REWARD_CONFIG.progressXp, gold: 0, completionBonusXp: 0 }
  }

  const completionBonusXp = input.activityKind === 'quest'
    ? REWARD_CONFIG.questCompletionXp
    : REWARD_CONFIG.ritualCompletionXp
  const effortBonus = Math.min(
    REWARD_CONFIG.maxEffortBonus,
    Math.max(0, Math.round(input.effortMinutes / REWARD_CONFIG.effortDivisorMinutes) * 4),
  )

  return {
    xp: completionBonusXp + effortBonus,
    gold: REWARD_CONFIG.completionGold + Math.round(effortBonus / 2),
    completionBonusXp,
  }
}
