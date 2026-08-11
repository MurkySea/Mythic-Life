import Link from 'next/link'
import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { ensureRecurringTasks } from '@/app/actions'
import { completeTask } from '@/app/complete-task'
import TaskLane from '@/components/TaskLane'
import { PendingCircleButton } from '@/components/PendingSubmit'
import {
  MythicEmptyState,
  MythicPage,
  MythicPageHeader,
  MythicPanel,
  MythicSectionHeader,
} from '@/components/MythicSurface'
import { MythicIcon } from '@/components/MythicIcons'
import { activateApprovedCampfireTasks } from '@/lib/campfire-actions'
import { MUST_DO_CAP, splitTaskLanes, type TaskRow } from '@/lib/task-lanes'
import styles from './today.module.css'
import { selectAdventureChoices } from '@/lib/behavior/adventure'
import type { BehavioralTask, MomentumBand } from '@/lib/behavior/types'

export const dynamic = 'force-dynamic'

function chicagoDateLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', weekday: 'long', month: 'short', day: 'numeric',
  }).format(new Date())
}

function taskDomains(task: TaskRow): string[] {
  return String(task.domains || task.domain || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 3)
}

function isTodayFocus(task: TaskRow): boolean {
  const recurrence = String(task.recurrence || '').toLowerCase()
  return Boolean(task.is_today || task.must_do || ((recurrence === 'daily' || recurrence === 'weekly') && task.is_today))
}

export default async function TodayPage() {
  if (!hasSupabaseEnv()) {
    return <MythicPage><MythicPageHeader eyebrow="Daily command" title="Today" subtitle="Supabase environment configuration is missing." /></MythicPage>
  }

  await Promise.all([ensureRecurringTasks(), activateApprovedCampfireTasks()])
  const supabase = await createClient()
  const [{ data: allTasks }, { data: momentumRow }] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('momentum_states').select('band, score').eq('scope_type', 'global').eq('scope_key', 'global').maybeSingle(),
  ])
  const rows = (allTasks || []) as TaskRow[]
  const { routine, mustDos, master } = splitTaskLanes(rows)
  const focusOpen = routine.length + mustDos.length
  const focusDone = rows.filter((task) => task.is_completed && isTodayFocus(task)).length
  const focusTotal = focusOpen + focusDone
  const focusPct = focusTotal > 0 ? Math.round((focusDone / focusTotal) * 100) : 0
  const primaryQuest = mustDos[0] || routine[0] || null
  const urgentOrders = primaryQuest === mustDos[0] ? mustDos.slice(1) : mustDos
  const remainingRoutine = primaryQuest === routine[0] ? routine.slice(1) : routine
  const primaryDomains = primaryQuest ? taskDomains(primaryQuest) : []
  const momentumBand = (momentumRow?.band || 'Dormant') as MomentumBand
  const adventureChoices = selectAdventureChoices({
    momentum: momentumBand,
    tasks: rows.map((task): BehavioralTask => ({
      id: task.id,
      title: task.title,
      activityKind: task.activity_kind || (task.recurrence === 'daily' || task.recurrence === 'weekly' ? 'ritual' : 'quest'),
      domainKeys: taskDomains(task),
      priority: Number(task.priority_score) || (task.must_do ? 9 : task.is_today ? 7 : 5),
      effortMinutes: Number(task.effort_minutes) || 30,
      createdAt: task.created_at || new Date().toISOString(),
      dueAt: task.due_at,
      completedAt: task.completed_at,
      progressCurrent: Number(task.progress_current) || 0,
      progressTarget: Number(task.progress_target) || 1,
      isToday: Boolean(task.is_today),
      mustDo: Boolean(task.must_do),
    })),
  })

  return (
    <MythicPage>
      <MythicPageHeader
        eyebrow="Daily command"
        title="Today&apos;s Quest Board"
        subtitle={chicagoDateLabel()}
        aside={<div className={styles.summarySeal} aria-label={`${focusOpen} open focus items`}><p className={styles.summaryValue}>{focusOpen}</p><p className={styles.summaryLabel}>Open</p></div>}
      />

      <MythicPanel tone="gold" className={styles.commandPanel}>
        <div className={styles.commandTop}>
          <div><p className={styles.commandLabel}>Day&apos;s standing order</p><p className={styles.commandText}>{focusOpen === 0 ? 'The board is clear. Choose the next worthy thing deliberately.' : `${focusOpen} open order${focusOpen === 1 ? '' : 's'} remain before the day is won.`}</p></div>
          <p className={styles.progressValue}>{focusPct}%</p>
        </div>
        <div className={styles.progressTrack} aria-label={`${focusPct}% complete`}><div className={styles.progressFill} style={{ width: `${focusPct}%` }} /></div>
      </MythicPanel>

      <nav className={styles.actions} aria-label="Quest planning actions">
        <Link href="/mother-list" className={styles.actionLink}><span>Plan campaigns</span><span className={styles.actionIcon}><MythicIcon name="plan" size={18} /></span></Link>
        <Link href="/task-generator" className={styles.actionLink}><span>Forge new quest</span><span className={styles.actionIcon}><MythicIcon name="add" size={18} /></span></Link>
      </nav>

      <div className={styles.board}>
        <section>
          <MythicSectionHeader title="Give Me an Adventure" hint={`${momentumBand} momentum`} sigil={<MythicIcon name="quest" size={17} />} />
          {adventureChoices.length > 0 ? (
            <div className={styles.adventureGrid}>
              {adventureChoices.map((choice) => (
                <MythicPanel key={choice.category} tone={choice.category === 'Dungeon' ? 'gold' : 'violet'} className={styles.adventureCard}>
                  <p className={styles.adventureCategory}>{choice.category}</p>
                  <h2 className={styles.adventureTitle}>{choice.task.title}</h2>
                  <p className={styles.adventureReason}>{choice.reason}</p>
                  <div className={styles.adventureMeta}><span>{choice.task.effortMinutes} min</span><span>Priority {choice.task.priority}</span></div>
                </MythicPanel>
              ))}
            </div>
          ) : <MythicEmptyState title="No worthy paths are waiting." body="The board is clear. Rest, explore, or forge a new quest deliberately." mark={<MythicIcon name="quest" size={28} />} />}
        </section>

        <section className={styles.primaryWrap}>
          <MythicSectionHeader title="Primary Quest" hint={primaryQuest ? 'Highest priority' : 'Unassigned'} sigil={<MythicIcon name="primaryQuest" size={17} />} />
          {primaryQuest ? (
            <MythicPanel tone="gold" emphasis className={styles.primaryCard}>
              <div className={styles.primaryHeader}>
                <div><p className={styles.primaryKicker}>Claim the day</p><h2 className={styles.primaryTitle}>{primaryQuest.title}</h2>{primaryQuest.notes && <p className={styles.primaryNotes}>{primaryQuest.notes}</p>}</div>
                <form action={completeTask} className={styles.primaryComplete}><input type="hidden" name="id" value={primaryQuest.id} /><PendingCircleButton title={`Complete ${primaryQuest.title}`} /></form>
              </div>
              {primaryDomains.length > 0 && <div className={styles.domainRow}>{primaryDomains.map((domain) => <span key={domain} className={styles.domainTag}>{domain}</span>)}</div>}
              <div className={styles.rewardRail} aria-label="Completion rewards">
                <div className={styles.reward}><MythicIcon name="spark" size={18} /><p className={styles.rewardValue}>XP</p><p className={styles.rewardLabel}>Skill growth</p></div>
                <div className={styles.reward}><MythicIcon name="relationship" size={18} /><p className={styles.rewardValue}>Bond</p><p className={styles.rewardLabel}>Companion</p></div>
                <div className={styles.reward}><MythicIcon name="rewards" size={18} /><p className={styles.rewardValue}>Loot</p><p className={styles.rewardLabel}>Reward roll</p></div>
              </div>
            </MythicPanel>
          ) : <MythicEmptyState title="No primary quest has been chosen." body="Pull one meaningful task onto Today or forge a new quest." mark={<MythicIcon name="primaryQuest" size={28} />} />}
        </section>

        <TaskLane label="Urgent Orders" hint={`${mustDos.length}/${MUST_DO_CAP}`} tasks={urgentOrders} empty="Pull up to five intentional one-time tasks onto Today from the Master List." accent="gold" />
        {master.length > 0 && <><TaskLane label="Master List" hint={`${master.length} open`} tasks={master.slice(0, 12)} empty="The wider campaign ledger is clear." accent="violet" />{master.length > 12 && <Link href="/mother-list" className={styles.moreLink}>Open the full ledger of {master.length} quests →</Link>}</>}
        <TaskLane label="Rituals" hint={routine.length ? `${routine.length}` : undefined} tasks={remainingRoutine} empty="No rituals are ready in the current rhythm." accent="zinc" />

        <section>
          <MythicSectionHeader title="Calendar" hint="Coming soon" sigil={<MythicIcon name="calendar" size={17} />} />
          <MythicPanel tone="blue" className={styles.calendarPanel}>
            <div className={styles.calendarSeal} aria-hidden><MythicIcon name="calendar" size={24} /></div>
            <p className={styles.calendarTitle}>The calendar chamber is still sealed.</p>
            <p className={styles.calendarBody}>Appointments and events will appear here once a calendar connection is added.</p>
          </MythicPanel>
        </section>
      </div>
    </MythicPage>
  )
}
