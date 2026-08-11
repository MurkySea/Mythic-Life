import { SKILLS, type SkillKey } from '@/lib/skills'

export const HABIT_TRACKING_TYPES = ['check', 'counter', 'timer', 'stopwatch'] as const
export type HabitTrackingType = (typeof HABIT_TRACKING_TYPES)[number]

export const HABIT_FREQUENCIES = ['daily', 'specific_days'] as const
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number]

export const HABIT_ICON_NAMES = [
  'training',
  'spark',
  'skills',
  'streak',
  'map',
  'calendar',
  'relationship',
  'achievement',
] as const
export type HabitIconName = (typeof HABIT_ICON_NAMES)[number]

export const IMPULSE_CATEGORIES = [
  'scrolling',
  'food',
  'spending',
  'sexual',
  'anger',
  'other',
] as const
export type ImpulseCategory = (typeof IMPULSE_CATEGORIES)[number]

export const IMPULSE_CATEGORY_LABELS: Record<ImpulseCategory, string> = {
  scrolling: 'Scrolling',
  food: 'Food',
  spending: 'Spending',
  sexual: 'Sexual',
  anger: 'Anger',
  other: 'Other',
}

export const WEEKDAYS = [
  { value: 0, short: 'Sun', label: 'Sunday' },
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
] as const

export interface HabitRow {
  id: string
  user_id: string
  title: string
  description: string | null
  tracking_type: HabitTrackingType
  target_value: number | null
  target_unit: string | null
  target_seconds: number | null
  frequency: HabitFrequency
  days_of_week: number[]
  xp_reward: number
  skill_key: SkillKey | null
  icon: string
  is_impulse_resistance: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface HabitLogRow {
  id: string
  user_id: string
  habit_id: string
  logged_date: string
  value: number
  duration_seconds: number
  completed: boolean
  completed_at: string | null
  rewarded_at: string | null
  reward_xp: number
  created_at: string
  updated_at: string
}

export interface HabitSessionRow {
  id: string
  user_id: string
  habit_id: string
  logged_date: string
  started_at: string
  active_started_at: string | null
  paused_at: string | null
  ended_at: string | null
  accumulated_seconds: number
  final_duration_seconds: number | null
  status: 'running' | 'paused' | 'finished'
  created_at: string
  updated_at: string
}

export interface HabitEventRow {
  id: string
  user_id: string
  habit_id: string
  log_id: string
  session_id: string | null
  request_id: string | null
  logged_date: string
  event_type: HabitTrackingType
  value: number
  duration_seconds: number
  impulse_category: ImpulseCategory | null
  created_at: string
}

export interface HabitPeriodStat {
  completed: number
  scheduled: number
  consistency: number
}

export interface HabitTrendPoint extends HabitPeriodStat {
  start: string
  end: string
  label: string
}

export interface HabitAnalytics {
  last7: HabitPeriodStat
  last30: HabitPeriodStat
  totalCompletions: number
  totalRepetitions: number
  totalDurationSeconds: number
  totalSessions: number
  trend: HabitTrendPoint[]
}

export interface HabitSuggestion {
  slug: string
  title: string
  trackingType: HabitTrackingType
  targetValue?: number
  targetUnit?: string
  targetSeconds?: number
  icon: HabitIconName
  skillKey?: SkillKey
  xpReward: number
  impulse?: boolean
}

export const HABIT_SUGGESTIONS: HabitSuggestion[] = [
  { slug: 'silence', title: 'Silence', trackingType: 'timer', targetSeconds: 120, icon: 'spark', skillKey: 'discipline', xpReward: 6 },
  { slug: 'outside', title: 'Outside', trackingType: 'timer', targetSeconds: 600, icon: 'map', skillKey: 'wisdom', xpReward: 6 },
  { slug: 'movement', title: 'Movement', trackingType: 'timer', targetSeconds: 1200, icon: 'training', skillKey: 'fitness', xpReward: 8 },
  { slug: 'intentional-meal', title: 'Intentional Meal', trackingType: 'check', icon: 'achievement', skillKey: 'stewardship', xpReward: 5 },
  { slug: 'delayed-impulse', title: 'Delayed Impulse', trackingType: 'counter', targetValue: 1, targetUnit: 'choice', icon: 'streak', skillKey: 'discipline', xpReward: 6, impulse: true },
  { slug: 'sleep-routine', title: 'Sleep Routine', trackingType: 'check', icon: 'calendar', skillKey: 'discipline', xpReward: 5 },
]

export function isTrackingType(value: string): value is HabitTrackingType {
  return (HABIT_TRACKING_TYPES as readonly string[]).includes(value)
}

export function isHabitFrequency(value: string): value is HabitFrequency {
  return (HABIT_FREQUENCIES as readonly string[]).includes(value)
}

export function isHabitIcon(value: string): value is HabitIconName {
  return (HABIT_ICON_NAMES as readonly string[]).includes(value)
}

export function isImpulseCategory(value: string): value is ImpulseCategory {
  return (IMPULSE_CATEGORIES as readonly string[]).includes(value)
}

export function isSkillKey(value: string): value is SkillKey {
  return (SKILLS as readonly string[]).includes(value)
}

export function chicagoDateKey(value: Date | string = new Date()): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date')
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function addDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day + days, 12))
  return value.toISOString().slice(0, 10)
}

export function weekdayForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
}

export function isHabitScheduledOn(
  habit: Pick<HabitRow, 'frequency' | 'days_of_week' | 'created_at'>,
  dateKey: string
): boolean {
  const createdDate = chicagoDateKey(habit.created_at)
  if (dateKey < createdDate) return false
  if (habit.frequency === 'daily') return true
  return habit.days_of_week.includes(weekdayForDateKey(dateKey))
}

export function habitIsComplete(
  habit: Pick<HabitRow, 'tracking_type' | 'target_value' | 'target_seconds'>,
  progress: Pick<HabitLogRow, 'value' | 'duration_seconds'>
): boolean {
  switch (habit.tracking_type) {
    case 'check':
      return progress.value >= 1
    case 'counter':
      return progress.value >= Math.max(1, habit.target_value || 1)
    case 'timer':
      return progress.duration_seconds >= Math.max(1, habit.target_seconds || 1)
    case 'stopwatch':
      return progress.duration_seconds > 0
  }
}

export function shouldAwardCompletion(opts: {
  isCompleted: boolean
  rewardedAt: string | null
}): boolean {
  return opts.isCompleted && !opts.rewardedAt
}

export function elapsedSessionSeconds(
  session: Pick<HabitSessionRow, 'status' | 'accumulated_seconds' | 'active_started_at'>,
  at: Date | number = new Date()
): number {
  const accumulated = Math.max(0, Math.floor(session.accumulated_seconds || 0))
  if (session.status !== 'running' || !session.active_started_at) return accumulated
  const atMs = typeof at === 'number' ? at : at.getTime()
  const activeMs = new Date(session.active_started_at).getTime()
  if (!Number.isFinite(activeMs)) return accumulated
  return accumulated + Math.max(0, Math.floor((atMs - activeMs) / 1000))
}

export function formatDuration(totalSeconds: number, compact = false): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (compact && hours > 0) return `${hours}h ${minutes}m`
  if (compact) return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function habitTargetLabel(habit: Pick<HabitRow, 'tracking_type' | 'target_value' | 'target_unit' | 'target_seconds'>): string {
  if (habit.tracking_type === 'check') return 'Complete once'
  if (habit.tracking_type === 'stopwatch') return 'Open practice'
  if (habit.tracking_type === 'timer') return formatDuration(habit.target_seconds || 0, true)
  const target = habit.target_value || 1
  return `${target} ${habit.target_unit || (target === 1 ? 'repetition' : 'repetitions')}`
}

function periodStat(
  habit: HabitRow,
  logsByDate: Map<string, HabitLogRow>,
  start: string,
  end: string
): HabitPeriodStat {
  let scheduled = 0
  let completed = 0
  for (let date = start; date <= end; date = addDateKey(date, 1)) {
    if (!isHabitScheduledOn(habit, date)) continue
    scheduled += 1
    if (logsByDate.get(date)?.completed) completed += 1
  }
  return {
    completed,
    scheduled,
    consistency: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
  }
}

export function calculateHabitAnalytics(opts: {
  habit: HabitRow
  logs: HabitLogRow[]
  today: string
  totalSessions?: number
}): HabitAnalytics {
  const logs = opts.logs.filter((log) => log.habit_id === opts.habit.id)
  const byDate = new Map(logs.map((log) => [log.logged_date, log]))
  const last7 = periodStat(opts.habit, byDate, addDateKey(opts.today, -6), opts.today)
  const last30 = periodStat(opts.habit, byDate, addDateKey(opts.today, -29), opts.today)
  const trend: HabitTrendPoint[] = []

  for (let window = 3; window >= 0; window -= 1) {
    const end = addDateKey(opts.today, -(window * 7))
    const start = addDateKey(end, -6)
    const stat = periodStat(opts.habit, byDate, start, end)
    trend.push({ ...stat, start, end, label: window === 0 ? 'Now' : `${window}w` })
  }

  return {
    last7,
    last30,
    totalCompletions: logs.filter((log) => log.completed).length,
    totalRepetitions: logs.reduce((sum, log) => sum + Number(log.value || 0), 0),
    totalDurationSeconds: logs.reduce((sum, log) => sum + Number(log.duration_seconds || 0), 0),
    totalSessions: opts.totalSessions ?? logs.filter((log) => log.completed).length,
    trend,
  }
}

export function calculateTrainingSummary(opts: {
  habits: HabitRow[]
  logs: HabitLogRow[]
  today: string
}): {
  completedToday: number
  scheduledToday: number
  last7: HabitPeriodStat
  practiceSecondsToday: number
} {
  let completedToday = 0
  let scheduledToday = 0
  let completed = 0
  let scheduled = 0
  let practiceSecondsToday = 0
  const active = opts.habits.filter((habit) => habit.is_active)
  const logsByHabit = new Map<string, Map<string, HabitLogRow>>()

  for (const log of opts.logs) {
    const byDate = logsByHabit.get(log.habit_id) ?? new Map<string, HabitLogRow>()
    byDate.set(log.logged_date, log)
    logsByHabit.set(log.habit_id, byDate)
  }

  for (const habit of active) {
    const byDate = logsByHabit.get(habit.id) ?? new Map<string, HabitLogRow>()
    if (isHabitScheduledOn(habit, opts.today)) {
      scheduledToday += 1
      if (byDate.get(opts.today)?.completed) completedToday += 1
    }
    practiceSecondsToday += byDate.get(opts.today)?.duration_seconds || 0
    const stat = periodStat(habit, byDate, addDateKey(opts.today, -6), opts.today)
    completed += stat.completed
    scheduled += stat.scheduled
  }

  return {
    completedToday,
    scheduledToday,
    last7: {
      completed,
      scheduled,
      consistency: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
    },
    practiceSecondsToday,
  }
}
