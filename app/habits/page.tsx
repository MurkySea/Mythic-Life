import { redirect } from 'next/navigation'
import { MythicIcon } from '@/components/MythicIcons'
import {
  MythicEmptyState,
  MythicPage,
  MythicPageHeader,
} from '@/components/MythicSurface'
import {
  addDateKey,
  chicagoDateKey,
  type HabitEventRow,
  type HabitLogRow,
  type HabitRow,
  type HabitSessionRow,
} from '@/lib/habits'
import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import HabitsTrainingGrounds from './HabitsTrainingGrounds'

export const dynamic = 'force-dynamic'

function normalizeHabit(row: HabitRow): HabitRow {
  return {
    ...row,
    target_value: row.target_value == null ? null : Number(row.target_value),
    target_seconds: row.target_seconds == null ? null : Number(row.target_seconds),
    xp_reward: Number(row.xp_reward || 0),
    sort_order: Number(row.sort_order || 0),
    days_of_week: Array.isArray(row.days_of_week)
      ? row.days_of_week.map(Number)
      : [0, 1, 2, 3, 4, 5, 6],
  }
}

function normalizeLog(row: HabitLogRow): HabitLogRow {
  return {
    ...row,
    value: Number(row.value || 0),
    duration_seconds: Number(row.duration_seconds || 0),
    reward_xp: Number(row.reward_xp || 0),
  }
}

function normalizeSession(row: HabitSessionRow): HabitSessionRow {
  return {
    ...row,
    accumulated_seconds: Number(row.accumulated_seconds || 0),
    final_duration_seconds: row.final_duration_seconds == null
      ? null
      : Number(row.final_duration_seconds),
  }
}

function normalizeEvent(row: HabitEventRow): HabitEventRow {
  return {
    ...row,
    value: Number(row.value || 0),
    duration_seconds: Number(row.duration_seconds || 0),
  }
}

export default async function HabitsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <MythicPage>
        <MythicPageHeader
          eyebrow="Daily training"
          title="Training Grounds"
          subtitle="Supabase environment configuration is missing."
        />
      </MythicPage>
    )
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  const today = chicagoDateKey()
  const ownerId = authData.user.id
  const [habitsResult, logsResult, sessionsResult, eventsResult, skillsResult] = await Promise.all([
    supabase
      .from('habits')
      .select('*')
      .eq('user_id', ownerId)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', ownerId)
      .order('logged_date', { ascending: false })
      .limit(5000),
    supabase
      .from('habit_sessions')
      .select('*')
      .eq('user_id', ownerId)
      .order('started_at', { ascending: false })
      .limit(5000),
    supabase
      .from('habit_events')
      .select('*')
      .eq('user_id', ownerId)
      .gte('logged_date', addDateKey(today, -89))
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('player_skills').select('skill, xp, level'),
  ])

  if (habitsResult.error) {
    console.error('HabitsPage: habits query failed', habitsResult.error)
    return (
      <MythicPage>
        <MythicPageHeader
          eyebrow="Daily training"
          title="Training Grounds"
          subtitle="Train what you repeat."
        />
        <MythicEmptyState
          title="The Training Grounds are not yet inscribed."
          body="Apply the pending habits migration to Supabase, then return here."
          mark={<MythicIcon name="training" size={26} />}
        />
      </MythicPage>
    )
  }

  for (const result of [logsResult, sessionsResult, eventsResult, skillsResult]) {
    if (result.error) console.error('HabitsPage: supporting query failed', result.error)
  }

  const skillXp: Record<string, number> = {}
  for (const row of skillsResult.data || []) skillXp[row.skill] = Number(row.xp || 0)

  return (
    <HabitsTrainingGrounds
      today={today}
      habits={(habitsResult.data || []).map((row) => normalizeHabit(row as HabitRow))}
      logs={(logsResult.data || []).map((row) => normalizeLog(row as HabitLogRow))}
      sessions={(sessionsResult.data || []).map((row) => normalizeSession(row as HabitSessionRow))}
      events={(eventsResult.data || []).map((row) => normalizeEvent(row as HabitEventRow))}
      skillXp={skillXp}
    />
  )
}
