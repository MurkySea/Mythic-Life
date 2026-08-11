import { describe, expect, it } from 'vitest'
import {
  calculateHabitAnalytics,
  chicagoDateKey,
  elapsedSessionSeconds,
  habitIsComplete,
  isHabitScheduledOn,
  shouldAwardCompletion,
  type HabitLogRow,
  type HabitRow,
  type HabitSessionRow,
} from '@/lib/habits'

function habit(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: 'habit-1',
    user_id: 'user-1',
    title: 'Silence',
    description: null,
    tracking_type: 'timer',
    target_value: null,
    target_unit: null,
    target_seconds: 120,
    frequency: 'daily',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    xp_reward: 5,
    skill_key: 'discipline',
    icon: 'spark',
    is_impulse_resistance: false,
    is_active: true,
    sort_order: 0,
    created_at: '2026-07-01T12:00:00.000Z',
    updated_at: '2026-07-01T12:00:00.000Z',
    ...overrides,
  }
}

function log(date: string, completed = true): HabitLogRow {
  return {
    id: `log-${date}`,
    user_id: 'user-1',
    habit_id: 'habit-1',
    logged_date: date,
    value: completed ? 1 : 0,
    duration_seconds: completed ? 120 : 30,
    completed,
    completed_at: completed ? `${date}T15:00:00.000Z` : null,
    rewarded_at: completed ? `${date}T15:00:00.000Z` : null,
    reward_xp: completed ? 5 : 0,
    created_at: `${date}T15:00:00.000Z`,
    updated_at: `${date}T15:00:00.000Z`,
  }
}

describe('habit schedule resolution', () => {
  it('schedules daily training every day after creation', () => {
    expect(isHabitScheduledOn(habit(), '2026-08-11')).toBe(true)
    expect(isHabitScheduledOn(habit(), '2026-06-30')).toBe(false)
  })

  it('honors selected local weekdays', () => {
    const weekdays = habit({ frequency: 'specific_days', days_of_week: [1, 3, 5] })
    expect(isHabitScheduledOn(weekdays, '2026-08-10')).toBe(true) // Monday
    expect(isHabitScheduledOn(weekdays, '2026-08-11')).toBe(false) // Tuesday
    expect(isHabitScheduledOn(weekdays, '2026-08-12')).toBe(true) // Wednesday
  })
})

describe('habit completion determination', () => {
  it('completes check and counter habits at their targets', () => {
    expect(habitIsComplete(habit({ tracking_type: 'check', target_seconds: null }), { value: 1, duration_seconds: 0 })).toBe(true)
    expect(habitIsComplete(habit({ tracking_type: 'counter', target_seconds: null, target_value: 3 }), { value: 2, duration_seconds: 0 })).toBe(false)
    expect(habitIsComplete(habit({ tracking_type: 'counter', target_seconds: null, target_value: 3 }), { value: 3, duration_seconds: 0 })).toBe(true)
  })

  it('completes timers only at target and stopwatches after recorded practice', () => {
    expect(habitIsComplete(habit({ target_seconds: 120 }), { value: 0, duration_seconds: 119 })).toBe(false)
    expect(habitIsComplete(habit({ target_seconds: 120 }), { value: 0, duration_seconds: 120 })).toBe(true)
    expect(habitIsComplete(habit({ tracking_type: 'stopwatch', target_seconds: null }), { value: 0, duration_seconds: 0 })).toBe(false)
    expect(habitIsComplete(habit({ tracking_type: 'stopwatch', target_seconds: null }), { value: 0, duration_seconds: 1 })).toBe(true)
  })
})

describe('persistent timer elapsed time', () => {
  const base: HabitSessionRow = {
    id: 'session-1',
    user_id: 'user-1',
    habit_id: 'habit-1',
    logged_date: '2026-08-11',
    started_at: '2026-08-11T15:00:00.000Z',
    active_started_at: '2026-08-11T15:01:00.000Z',
    paused_at: null,
    ended_at: null,
    accumulated_seconds: 42,
    final_duration_seconds: null,
    status: 'running',
    created_at: '2026-08-11T15:00:00.000Z',
    updated_at: '2026-08-11T15:01:00.000Z',
  }

  it('derives running time from accumulated time plus the authoritative active timestamp', () => {
    expect(elapsedSessionSeconds(base, new Date('2026-08-11T15:02:15.900Z'))).toBe(117)
  })

  it('does not add wall-clock time while paused', () => {
    expect(elapsedSessionSeconds({ ...base, status: 'paused', active_started_at: null }, new Date('2026-08-12T15:02:15.900Z'))).toBe(42)
  })
})

describe('habit reward idempotency', () => {
  it('awards only on the first un-rewarded completion transition', () => {
    expect(shouldAwardCompletion({ isCompleted: true, rewardedAt: null })).toBe(true)
    expect(shouldAwardCompletion({ isCompleted: true, rewardedAt: '2026-08-11T15:00:00Z' })).toBe(false)
    expect(shouldAwardCompletion({ isCompleted: false, rewardedAt: null })).toBe(false)
  })
})

describe('Chicago local dates and consistency', () => {
  it('attributes timestamps to the correct Chicago day across UTC midnight', () => {
    expect(chicagoDateKey('2026-08-11T02:30:00.000Z')).toBe('2026-08-10')
    expect(chicagoDateKey('2026-08-11T16:30:00.000Z')).toBe('2026-08-11')
    expect(chicagoDateKey('2026-03-08T07:30:00.000Z')).toBe('2026-03-08')
  })

  it('calculates reliable seven and thirty day consistency without streak resets', () => {
    const logs = [
      log('2026-08-05'),
      log('2026-08-06'),
      log('2026-08-08'),
      log('2026-08-09'),
      log('2026-08-11'),
    ]
    const analytics = calculateHabitAnalytics({ habit: habit(), logs, today: '2026-08-11' })
    expect(analytics.last7).toEqual({ completed: 5, scheduled: 7, consistency: 71 })
    expect(analytics.last30.completed).toBe(5)
    expect(analytics.last30.scheduled).toBe(30)
    expect(analytics.totalCompletions).toBe(5)
    expect(analytics.totalDurationSeconds).toBe(600)
    expect(analytics.trend).toHaveLength(4)
    expect(analytics.trend.at(-1)?.consistency).toBe(71)
  })
})
