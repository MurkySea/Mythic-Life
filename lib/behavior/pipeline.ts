import { selectWorldEvent, type RecentWorldEvent } from './events'
import { advanceMomentum, type MomentumState } from './momentum'
import { calculateCompletionReward } from './rewards'
import type { ActivityKind } from './types'

export function resolveCompletion(input: {
  activityKind: ActivityKind
  effortMinutes: number
  previousMomentum: MomentumState
  recentEvents: RecentWorldEvent[]
  completedAt: Date
  random?: () => number
}) {
  return {
    reward: calculateCompletionReward({
      activityKind: input.activityKind,
      effortMinutes: input.effortMinutes,
      isFinalCompletion: true,
    }),
    momentum: advanceMomentum(input.previousMomentum, input.completedAt),
    worldEvent: selectWorldEvent({
      recentEvents: input.recentEvents,
      now: input.completedAt,
      random: input.random,
    }),
  }
}
