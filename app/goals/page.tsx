import Link from 'next/link'
import { listGoals, PILLAR_LABELS } from '@/lib/engines/goals-store'
import type { Goal, GoalPillar } from '@/lib/engines/goals'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import {
  progressGoalAction,
  abandonGoalAction,
  pauseGoalAction,
  resumeGoalAction,
} from './actions'
import styles from './goals.module.css'

export const dynamic = 'force-dynamic'

const PILLAR_ICON: Record<GoalPillar, MythicIconName> = {
  stewardship: 'currency', faith: 'spark', marriage: 'relationship', body: 'skills',
  homestead: 'map', legacy: 'achievement', self: 'goals',
}

function progressPct(goal: Goal): number {
  if (goal.target <= 0) return 0
  return Math.min(100, Math.round((goal.progress / goal.target) * 100))
}

function GoalCard({ goal }: { goal: Goal }) {
  const pct = progressPct(goal)
  const isActive = goal.status === 'active'
  const isPaused = goal.status === 'paused'
  const isDone = goal.status === 'completed'
  const isAbandoned = goal.status === 'abandoned'
  const stateClass = isDone ? styles.completed : isAbandoned ? styles.abandoned : isPaused ? styles.paused : ''

  return (
    <article className={`${styles.card} ${stateClass}`} data-pillar={goal.pillar}>
      <div className={styles.node} aria-hidden><MythicIcon name={PILLAR_ICON[goal.pillar] || 'goals'} size={24} /></div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <h3 className={styles.goalTitle}>{goal.title}</h3>
          <span className={styles.horizon}>{goal.horizon}</span>
        </div>
        <p className={styles.meta}>
          {PILLAR_LABELS[goal.pillar]} · Campaign weight{' '}
          <span className={styles.weight} aria-label={`${goal.weight} of 5 weight`}>{'◆'.repeat(Math.max(1, Math.min(5, goal.weight)))}</span>
        </p>
        {goal.notes && <p className={styles.notes}>{goal.notes}</p>}

        {!isAbandoned && (
          <div className={styles.progressBlock}>
            <div className={styles.progressTop}><span>Territory gained · {goal.progress} / {goal.target}</span><span className={styles.progressPct}>{pct}%</span></div>
            <div className={styles.track} role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className={styles.fill} style={{ width: `${pct}%` }} /></div>
          </div>
        )}

        {isActive && (
          <div className={styles.actions}>
            <form action={progressGoalAction}><input type="hidden" name="id" value={goal.id} /><button type="submit" className={styles.primaryAction}>Advance</button></form>
            <Link href={`/goals/${goal.id}/edit`} className={styles.secondaryAction}>Edit</Link>
            <form action={pauseGoalAction}><input type="hidden" name="id" value={goal.id} /><button type="submit" className={styles.secondaryAction}>Pause</button></form>
            <form action={abandonGoalAction}><input type="hidden" name="id" value={goal.id} /><button type="submit" className={styles.dangerAction}>Abandon</button></form>
          </div>
        )}

        {isPaused && (
          <div className={styles.actions}>
            <form action={resumeGoalAction}><input type="hidden" name="id" value={goal.id} /><button type="submit" className={styles.resumeAction}>Resume</button></form>
            <Link href={`/goals/${goal.id}/edit`} className={styles.secondaryAction}>Edit</Link>
          </div>
        )}

        {isDone && <p className={styles.statusLine}>Campaign completed{goal.completedAt ? ` · ${goal.completedAt}` : ''}</p>}
        {isAbandoned && <p className={styles.statusLine}>Campaign left behind</p>}
      </div>
    </article>
  )
}

function SectionHeader({ title, hint, icon }: { title: string; hint?: string; icon: MythicIconName }) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitleWrap}><span className={styles.sectionSeal} aria-hidden><MythicIcon name={icon} size={16} /></span><h2 className={styles.sectionTitle}>{title}</h2></div>
      {hint && <span className={styles.sectionHint}>{hint}</span>}
    </div>
  )
}

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string }> }) {
  const params = await searchParams
  const [active, paused, done, abandoned] = await Promise.all([
    listGoals({ status: 'active' }), listGoals({ status: 'paused' }), listGoals({ status: 'completed' }), listGoals({ status: 'abandoned' }),
  ])
  const history = [...done, ...abandoned].slice(0, 12)

  return (
    <main className={styles.page}>
      <div className={styles.mapTexture} aria-hidden />
      <header className={styles.header}>
        <Link href="/" className={styles.backButton} aria-label="Back to Home">‹</Link>
        <div><p className={styles.eyebrow}>Strategic direction</p><h1 className={styles.title}>Campaign Atlas</h1></div>
        <Link href="/goals/new" className={styles.newButton}><MythicIcon name="add" size={16} /><span>New</span></Link>
      </header>

      {(params.created === '1' || params.updated === '1') && <div className={styles.success}>{params.updated === '1' ? 'Campaign updated.' : 'Campaign marked on the atlas.'}</div>}

      <section className={styles.overview} aria-label="Campaign overview">
        <div className={styles.overviewTop}>
          <div><p className={styles.overviewKicker}>The long game</p><h2 className={styles.overviewTitle}>{active.length} active campaign{active.length === 1 ? '' : 's'}</h2><p className={styles.overviewBody}>Keep the directions that matter visible, measurable, and easy to adjust.</p></div>
          <div className={styles.compass} aria-hidden><MythicIcon name="map" size={25} /></div>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}><p className={styles.statValue}>{active.length}</p><p className={styles.statLabel}>Active</p></div>
          <div className={styles.stat}><p className={styles.statValue}>{paused.length}</p><p className={styles.statLabel}>Paused</p></div>
          <div className={styles.stat}><p className={styles.statValue}>{done.length}</p><p className={styles.statLabel}>Won</p></div>
        </div>
      </section>

      <section className={styles.section}>
        <SectionHeader title="Active Campaigns" hint={`${active.length} active`} icon="goals" />
        {active.length === 0 ? (
          <div className={styles.empty}><div className={styles.emptyMark} aria-hidden><MythicIcon name="map" size={24} /></div><p className={styles.emptyTitle}>No active goals.</p><p className={styles.emptyBody}>Choose one direction worth sustained effort.</p><Link href="/goals/new" className={styles.emptyLink}>Create a goal →</Link></div>
        ) : <div className={styles.campaigns}>{active.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div>}
      </section>

      {paused.length > 0 && <section className={styles.section}><SectionHeader title="Paused" hint={`${paused.length}`} icon="plan" /><div className={styles.campaigns}>{paused.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div></section>}
      {history.length > 0 && <section className={styles.section}><SectionHeader title="History" hint={`${history.length}`} icon="achievement" /><div className={styles.campaigns}>{history.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div></section>}
    </main>
  )
}
