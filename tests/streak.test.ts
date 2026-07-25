import { describe, it, expect } from 'vitest'
import { nextStreakCount } from '@/lib/engines/streak'

describe('nextStreakCount', () => {
  it('returns previous for non-recurring tasks', () => {
    expect(
      nextStreakCount({
        recurrence: 'once',
        prevCount: 5,
        lastStreakDate: '2026-07-24',
        todayYmd: '2026-07-25',
        yesterdayYmd: '2026-07-24',
      })
    ).toBe(5)
  })

  it('increments when last was yesterday', () => {
    expect(
      nextStreakCount({
        recurrence: 'daily',
        prevCount: 3,
        lastStreakDate: '2026-07-24',
        todayYmd: '2026-07-25',
        yesterdayYmd: '2026-07-24',
      })
    ).toBe(4)
  })

  it('resets when a day was missed', () => {
    expect(
      nextStreakCount({
        recurrence: 'daily',
        prevCount: 7,
        lastStreakDate: '2026-07-22',
        todayYmd: '2026-07-25',
        yesterdayYmd: '2026-07-24',
      })
    ).toBe(1)
  })

  it('is idempotent for same-day completion', () => {
    expect(
      nextStreakCount({
        recurrence: 'daily',
        prevCount: 4,
        lastStreakDate: '2026-07-25',
        todayYmd: '2026-07-25',
        yesterdayYmd: '2026-07-24',
      })
    ).toBe(4)
  })
})
