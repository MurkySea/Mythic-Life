/**
 * Pure streak calculation helpers.
 * Used by updateTaskStreak and covered by unit tests.
 */

export function nextStreakCount(opts: {
  recurrence: string | null | undefined
  prevCount: number
  lastStreakDate: string | null | undefined
  todayYmd: string
  yesterdayYmd: string
}): number {
  const { recurrence, prevCount, lastStreakDate, todayYmd, yesterdayYmd } = opts

  if (recurrence !== 'daily' && recurrence !== 'weekly') {
    return prevCount || 0
  }

  if (lastStreakDate === todayYmd) return prevCount // already counted today
  if (lastStreakDate === yesterdayYmd) return prevCount + 1
  return 1
}
