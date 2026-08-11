import Link from 'next/link'
import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { ensureRecurringTasks } from './actions'
import { activateApprovedCampfireTasks } from '@/lib/campfire-actions'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import TaskActions from '@/components/TaskActions'
import { listGoals, PILLAR_LABELS } from '@/lib/engines/goals-store'
import type { GoalPillar } from '@/lib/engines/goals'
import { splitTaskLanes, type TaskRow } from '@/lib/task-lanes'
import { chicagoDateKey, formatDuration, isHabitScheduledOn, type HabitLogRow, type HabitRow } from '@/lib/habits'
import HomeActionShell from './HomeActionShell'
import styles from './home.module.css'

export const dynamic = 'force-dynamic'

const PILLAR_ICON: Record<GoalPillar, MythicIconName> = {
  stewardship: 'currency', faith: 'spark', marriage: 'relationship', body: 'streak',
  homestead: 'map', legacy: 'achievement', self: 'skills',
}

export default async function HubPage() {
  if (!hasSupabaseEnv()) {
    return <main className={styles.home}><section className={styles.hero}><p className={styles.eyebrow}>Mythic Life</p><h1 className={styles.name}>Configuration needed</h1></section></main>
  }

  await Promise.all([ensureRecurringTasks(), activateApprovedCampfireTasks()])
  const supabase = await createClient()
  const today = chicagoDateKey()
  const [tasksResult, goalsResult, habitsResult, habitLogsResult] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200),
    listGoals({ status: 'active' }),
    supabase.from('habits').select('*').eq('is_active', true).order('sort_order').order('created_at'),
    supabase.from('habit_logs').select('*').eq('logged_date', today),
  ])

  const rows = (tasksResult.data || []) as TaskRow[]
  const { routine, mustDos } = splitTaskLanes(rows)
  const focusOpen = routine.length + mustDos.length
  const focusDone = rows.filter((task) => task.is_completed && (task.is_today || task.must_do)).length
  const topTasks = [...mustDos, ...routine].slice(0, 5)

  const activeGoals = goalsResult || []
  const topGoals = activeGoals.slice(0, 4)

  const habits = ((habitsResult.data || []) as HabitRow[]).filter((habit) => isHabitScheduledOn(habit, today))
  const logs = (habitLogsResult.data || []) as HabitLogRow[]
  const logByHabit = new Map(logs.map((log) => [log.habit_id, log]))
  const completedHabits = habits.filter((habit) => logByHabit.get(habit.id)?.completed).length
  const practiceSeconds = logs.reduce((sum, log) => sum + Number(log.duration_seconds || 0), 0)

  const menuItems: Array<{ href: string; label: string; sub: string; icon: MythicIconName; developer?: boolean }> = [
    { href: '/companions', label: 'Companions', sub: 'Party and relationships', icon: 'party' },
    { href: '/messages', label: 'Messages', sub: 'Conversations', icon: 'messages' },
    { href: '/camp', label: 'Campfire', sub: 'Reflect on the day', icon: 'spark' },
    { href: '/skills', label: 'Skills', sub: 'Practice and progression', icon: 'skills' },
    { href: '/standing', label: 'Standing', sub: 'Rhythm and soul ledger', icon: 'standing' },
    { href: '/standing/health', label: 'Health', sub: 'Condition and vital signs', icon: 'streak' },
    { href: '/rewards', label: 'Rewards', sub: 'Loot and earned rewards', icon: 'rewards' },
    { href: '/settings', label: 'Settings', sub: 'Codex and preferences', icon: 'settings' },
    { href: '/character-studio', label: 'Character Studio', sub: 'Voice calibration', icon: 'relationship', developer: true },
  ]

  return (
    <main className={`${styles.home} safe-bottom`}>
      <div className={styles.embers} aria-hidden />
      <section className={styles.hero} aria-label="Player profile">
        <div className={styles.identityRow}>
          <div className={styles.crest} aria-hidden><span className={styles.crestInitials}>MZ</span><span className={styles.crestRank}>Purpose</span></div>
          <div><p className={styles.eyebrow}>Mythic Life</p><h1 className={styles.name}>Mark Zito</h1><p className={styles.subtitle}>Open. Choose. Act.</p></div>
        </div>
        <div className={styles.resourceRow}>
          <div className={styles.resource}><span className={styles.resourceOrb}><MythicIcon name="quest" size={14} /></span><span><strong>{focusOpen}</strong><small>Tasks</small></span></div>
          <div className={styles.resource}><span className={styles.resourceOrb}><MythicIcon name="training" size={14} /></span><span><strong>{completedHabits}/{habits.length || '—'}</strong><small>Habits</small></span></div>
          <div className={styles.resource}><span className={styles.resourceOrb}><MythicIcon name="goals" size={14} /></span><span><strong>{activeGoals.length}</strong><small>Goals</small></span></div>
        </div>
      </section>

      <HomeActionShell
        menuItems={menuItems}
        tasks={
          <section className={styles.focusPanel}>
            <div className={styles.focusHeader}><div><p className={styles.cardKicker}>Today</p><h2>{focusOpen === 0 ? 'Nothing is demanding your attention.' : `${focusOpen} open task${focusOpen === 1 ? '' : 's'}`}</h2><p>{focusDone > 0 ? `${focusDone} completed today.` : 'Pick the next thing and move.'}</p></div><Link href="/task-generator" className={styles.quickAdd}>+ Task</Link></div>
            <div className={styles.simpleList}>
              {topTasks.length === 0 ? <p className={styles.emptyText}>Your task list is clear.</p> : topTasks.map((task) => (
                <div key={task.id} className={styles.simpleRow}>
                  <Link href={`/tasks/${task.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={styles.rowIcon}><MythicIcon name={task.must_do ? 'primaryQuest' : 'quest'} size={16} /></span>
                    <span className="min-w-0 flex-1"><strong>{task.title}</strong><small>{task.must_do ? 'Must do' : 'Routine'}</small></span>
                  </Link>
                  <TaskActions taskId={task.id} title={task.title} />
                </div>
              ))}
            </div>
            <Link href="/today" className={styles.primaryAction}>Open all tasks</Link>
          </section>
        }
        habits={
          <section className={styles.focusPanel}>
            <div className={styles.focusHeader}><div><p className={styles.cardKicker}>Training</p><h2>{habits.length === 0 ? 'No habits scheduled today.' : `${completedHabits}/${habits.length} trained`}</h2><p>{practiceSeconds > 0 ? `${formatDuration(practiceSeconds, true)} deliberate practice today.` : 'Train what you repeat.'}</p></div><Link href="/habits" className={styles.quickAdd}>+ Habit</Link></div>
            <div className={styles.simpleList}>
              {habits.slice(0, 5).map((habit) => { const log = logByHabit.get(habit.id); return <Link href="/habits" key={habit.id} className={styles.simpleRow}><span className={styles.rowIcon}><MythicIcon name="training" size={16} /></span><span><strong>{habit.title}</strong><small>{log?.completed ? 'Complete' : habit.tracking_type}</small></span><span className={styles.rowState}>{log?.completed ? '✓' : '›'}</span></Link> })}
              {habits.length === 0 && <p className={styles.emptyText}>Add one tiny repeatable behavior and start there.</p>}
            </div>
            <Link href="/habits" className={styles.primaryAction}>Open habits</Link>
          </section>
        }
        goals={
          <section className={styles.focusPanel}>
            <div className={styles.focusHeader}><div><p className={styles.cardKicker}>Direction</p><h2>{activeGoals.length === 0 ? 'No active goals.' : `${activeGoals.length} active goal${activeGoals.length === 1 ? '' : 's'}`}</h2><p>Keep the destination visible without living in the dashboard.</p></div><Link href="/goals" className={styles.quickAdd}>+ Goal</Link></div>
            <div className={styles.simpleList}>
              {topGoals.map((goal) => { const pct = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0; return <Link href="/goals" key={goal.id} className={styles.goalSimpleRow}><span className={styles.rowIcon}><MythicIcon name={PILLAR_ICON[goal.pillar]} size={16} /></span><span><strong>{goal.title}</strong><small>{PILLAR_LABELS[goal.pillar]} · {goal.horizon}</small><span className={styles.miniTrack}><i style={{ width: `${pct}%` }} /></span></span><span className={styles.goalPct}>{pct}%</span></Link> })}
              {topGoals.length === 0 && <p className={styles.emptyText}>Name one direction worth moving toward.</p>}
            </div>
            <Link href="/goals" className={styles.primaryAction}>Open goals</Link>
          </section>
        }
      />
    </main>
  )
}
