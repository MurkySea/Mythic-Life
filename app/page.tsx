import type { CSSProperties } from 'react'
import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import Link from 'next/link'
import { ensureRecurringTasks } from './actions'
import { claimDailyMuster } from './muster-actions'
import { readFeedback } from '@/lib/feedback'
import FeedbackBanners from '@/components/FeedbackBanners'
import MusterCard from '@/components/MusterCard'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'
import { loadStanding } from '@/lib/engines/standing-store'
import { chicagoYmd } from '@/lib/engines/muster'
import { splitTaskLanes, type TaskRow } from '@/lib/task-lanes'
import { activateApprovedCampfireTasks } from '@/lib/campfire-actions'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import { listGoals, PILLAR_LABELS } from '@/lib/engines/goals-store'
import type { GoalPillar } from '@/lib/engines/goals'
import HomeDashboardTabs from './HomeDashboardTabs'
import styles from './home.module.css'

export const dynamic = 'force-dynamic'

const PILLAR_ICON: Record<GoalPillar, MythicIconName> = {
  stewardship: 'currency', faith: 'spark', marriage: 'relationship', body: 'streak',
  homestead: 'map', legacy: 'achievement', self: 'skills',
}

export default async function HubPage() {
  if (!hasSupabaseEnv()) return <main className={styles.home}><section className={styles.hero}><p className={styles.eyebrow}>Mythic Life</p><h1 className={styles.name}>Configuration needed</h1></section></main>

  await Promise.all([ensureRecurringTasks(), activateApprovedCampfireTasks()])
  const feedback = await readFeedback()
  const [standingUi, standingRow, activeGoals] = await Promise.all([fetchLatestStanding(), loadStanding(), listGoals({ status: 'active' })])
  const supabase = await createClient()
  const { data: allTasks } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200)
  const rows = (allTasks || []) as TaskRow[]
  const { routine, mustDos } = splitTaskLanes(rows)
  const focusDone = rows.filter((task) => {
    if (!task.is_completed) return false
    const recurrence = String(task.recurrence || '').toLowerCase()
    return task.is_today || task.must_do || ((recurrence === 'daily' || recurrence === 'weekly') && task.is_today)
  }).length
  const focusOpen = routine.length + mustDos.length
  const focusTotal = focusOpen + focusDone
  const focusPct = focusTotal > 0 ? Math.round((focusDone / focusTotal) * 100) : 0
  const bestStreak = Math.max(0, ...rows.map((task) => task.streak_count || 0))
  const rhythm = standingUi?.rhythm
  const tier = tierStyle(rhythm?.tier)
  const musterClaimed = standingRow.last_muster_date === chicagoYmd()
  const topGoals = activeGoals.slice(0, 3)
  const moduleGroups: Array<{
    label: string
    modules: Array<{ href: string; label: string; sub: string; icon: MythicIconName; disabled?: boolean; developer?: boolean }>
  }> = [
    { label: 'Growth', modules: [{ href: '/skills', label: 'Skills', sub: 'Practice and progress', icon: 'skills' }] },
    { label: 'Companions', modules: [
      { href: '/companions', label: 'Party', sub: 'Your allies', icon: 'party' },
      { href: '/messages', label: 'Messages', sub: 'Conversations', icon: 'messages' },
      { href: '/companion-profile', label: 'Mirror', sub: 'Companion profile', icon: 'profile' },
    ] },
    { label: 'System', modules: [
      { href: '/settings', label: 'Codex', sub: 'Settings', icon: 'settings' },
      { href: '/character-studio', label: 'Character Studio', sub: 'Voice calibration', icon: 'relationship', developer: true },
    ] },
    { label: 'World', modules: [{ href: '#', label: 'Map', sub: 'Coming soon', icon: 'map', disabled: true }] },
  ]

  return (
    <main className={`${styles.home} safe-bottom`}>
      <div className={styles.embers} aria-hidden />
      <section className={styles.hero} aria-label="Player profile">
        <div className={styles.identityRow}>
          <div className={styles.crest} aria-hidden><span className={styles.crestInitials}>MZ</span><span className={styles.crestRank}>Purpose</span></div>
          <div><p className={styles.eyebrow}>Mythic Life</p><h1 className={styles.name}>Mark Zito</h1><p className={styles.subtitle}>The Unconventional Advisor</p></div>
        </div>
        <div className={styles.resourceRow}>
          <Link href="/today" className={styles.resource}><span className={styles.resourceOrb}><MythicIcon name="quest" size={14} /></span><span><strong>{focusDone}/{focusTotal || '—'}</strong><small>Today</small></span></Link>
          <Link href="/standing" className={styles.resource}><span className={styles.resourceOrb}><MythicIcon name="standing" size={14} /></span><span><strong>{rhythm ? tier.label : '—'}</strong><small>Rhythm</small></span></Link>
          <div className={styles.resource}><span className={styles.resourceOrb}><MythicIcon name="streak" size={14} /></span><span><strong>{bestStreak || '—'}</strong><small>Streak</small></span></div>
        </div>
      </section>

      <HomeDashboardTabs
        command={
          <div className={styles.stack}>
            {feedback && <FeedbackBanners feedback={feedback} />}
            {!musterClaimed && <div className={styles.systemInset}><MusterCard claimed={false} streak={standingRow.muster_streak || 0} dateCoins={standingRow.date_coins || 0} action={claimDailyMuster} /></div>}
            <Link href="/today" className={`${styles.campaignCard} ${styles.primaryCard}`}><div><p className={styles.cardKicker}>Today&apos;s quests</p><h2>{focusOpen === 0 ? 'The board is clear. Choose the next worthy thing.' : `${focusOpen} quest${focusOpen === 1 ? '' : 's'} await your hand.`}</h2><span>Routine · Must-dos · Master List</span></div><div className={styles.questSeal}>{focusOpen}</div></Link>
            <Link href="/camp" className={`${styles.campaignCard} ${styles.secondaryCard}`}><div><p className={styles.cardKicker}>Evening campfire</p><h2>Someone is waiting to hear how your day really went.</h2><span>Talk through the day · no score attached</span></div><div className={styles.standingSeal}><MythicIcon name="spark" size={20} /></div></Link>
          </div>
        }
        journey={
          <>
            <section className={styles.rankPanel} aria-label="Rank and daily progress">
              <div><p className={styles.eyebrow}>Current mantle</p><h2 className={styles.rankTitle}>Knight of Purpose</h2><p className={styles.rankMeta}>Rank III</p><p className={styles.vow}>Whatever you do, do it all for the glory of God.<span>1 Corinthians 10:31</span></p></div>
              <div className={styles.progressRing} style={{ '--progress': `${focusPct}%` } as CSSProperties} aria-label={`${focusPct}% of today's focus complete`}><div><p>{focusPct}%</p><small>Today</small></div></div>
            </section>

            <div className={styles.stack}>
              <Link href="/goals" className={styles.campaignCard}><div className={styles.cardBody}><div className={styles.cardHeading}><div><p className={styles.cardKicker}>Long campaigns</p><h2>Active Goals</h2></div><MythicIcon name="goals" size={22} /></div>{topGoals.length === 0 ? <p className={styles.emptyText}>No active goals. Name the direction before chasing speed.</p> : <div className={styles.goalList}>{topGoals.map((goal) => { const pct = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0; return <div className={styles.goalRow} key={goal.id}><span className={styles.goalSigil}><MythicIcon name={PILLAR_ICON[goal.pillar]} size={15} /></span><p>{goal.title}</p><small>{goal.progress}/{goal.target}</small><div className={styles.goalTrack}><span style={{ width: `${pct}%` }} /></div><em>{PILLAR_LABELS[goal.pillar]} · {goal.horizon}</em></div> })}</div>}</div></Link>
              <section className={styles.statusSection} aria-labelledby="condition-heading">
                <div className={styles.statusHeading}><div><p className={styles.cardKicker}>Condition and standing</p><h2 id="condition-heading">{rhythm ? <>Rhythm · {tier.label}{standingRow.baseline_phase ? ` · Phase ${standingRow.baseline_phase}` : ''}</> : 'Know where you stand.'}</h2></div></div>
                <div className={styles.destinationGrid}>
                  <Link href="/standing" className={styles.destinationCard}><span className={styles.standingSeal}><MythicIcon name="standing" size={18} /></span><span><strong>Soul Ledger</strong><small>Standing and rhythm</small></span></Link>
                  <Link href="/standing/health" className={styles.destinationCard}><span className={styles.standingSeal}><MythicIcon name="streak" size={18} /></span><span><strong>Vital Signs</strong><small>Health and condition</small></span></Link>
                </div>
              </section>
            </div>
          </>
        }
        grimoire={
          <>
            <section className={styles.directory} aria-label="Grimoire directory">
              {moduleGroups.map((group) => <div className={styles.directoryGroup} key={group.label}>
                <h2>{group.label}</h2>
                <div className={styles.moduleGrid}>
                  {group.modules.map((module) => { const content = <div className={styles.moduleContent}><div className={styles.iconHalo}><MythicIcon name={module.icon} size={20} /></div><div className={styles.moduleText}><p>{module.label}</p><small>{module.sub}</small>{module.developer && <em>Developer tool</em>}</div></div>; return module.disabled ? <div key={module.label} className={`${styles.moduleCard} ${styles.disabled}`} aria-disabled="true">{content}</div> : <Link key={module.label} href={module.href} className={styles.moduleCard}>{content}</Link> })}
                </div>
              </div>)}
            </section>
            <p className={styles.footerVow}>Enter deliberately. Leave stronger.</p>
          </>
        }
      />
    </main>
  )
}
