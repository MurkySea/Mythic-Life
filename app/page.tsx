import type { CSSProperties } from 'react'
import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import Link from 'next/link'
import { ensureRecurringTasks } from './actions'
import { maybeCompanionCheckIn } from './check-in-actions'
import { claimDailyMuster } from './muster-actions'
import { readFeedback } from '@/lib/feedback'
import FeedbackBanners from '@/components/FeedbackBanners'
import MusterCard from '@/components/MusterCard'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'
import { loadStanding } from '@/lib/engines/standing-store'
import { chicagoYmd } from '@/lib/engines/muster'
import { splitTaskLanes, type TaskRow } from '@/lib/task-lanes'
import { MODULE_ICONS, type ModuleIconKey } from '@/components/MythicIcons'
import { listGoals, PILLAR_LABELS } from '@/lib/engines/goals-store'
import type { GoalPillar } from '@/lib/engines/goals'
import styles from './home.module.css'

export const dynamic = 'force-dynamic'

const PILLAR_SIGIL: Record<GoalPillar, string> = {
  stewardship: '♜',
  faith: '✝',
  marriage: '◇',
  body: '⚔',
  homestead: '⌂',
  legacy: '♛',
  self: '✦',
}

export default async function HubPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="ml-title pt-8">Configuration needed</h1>
      </main>
    )
  }

  await ensureRecurringTasks()

  after(async () => {
    try {
      await maybeCompanionCheckIn()
      revalidatePath('/messages')
    } catch (e) {
      console.error('check-in failed', e)
    }
  })

  const feedback = await readFeedback()
  const [standingUi, standingRow, activeGoals] = await Promise.all([
    fetchLatestStanding(),
    loadStanding(),
    listGoals({ status: 'active' }),
  ])
  const supabase = await createClient()

  const { data: allTasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (allTasks || []) as TaskRow[]
  const { routine, mustDos } = splitTaskLanes(rows)

  const focusPool = rows.filter((t) => {
    if (!t.is_completed) return false
    const r = (t.recurrence || '').toLowerCase()
    return t.is_today || t.must_do || ((r === 'daily' || r === 'weekly') && t.is_today)
  })
  const focusOpen = routine.length + mustDos.length
  const focusDone = focusPool.length
  const focusTotal = focusOpen + focusDone
  const focusPct = focusTotal > 0 ? Math.round((focusDone / focusTotal) * 100) : 0

  const bestStreak = Math.max(0, ...rows.map((t) => t.streak_count || 0))

  const rhythm = standingUi?.rhythm
  const tier = tierStyle(rhythm?.tier)

  const today = chicagoYmd()
  const musterClaimed = standingRow.last_muster_date === today

  const topGoals = activeGoals.slice(0, 3)

  const modules: { href: string; label: ModuleIconKey; sub: string; disabled?: boolean }[] = [
    { href: '/today', label: 'Quests', sub: 'Today' },
    { href: '/skills', label: 'Skills', sub: 'Growth' },
    { href: '/companions', label: 'Party', sub: 'Allies' },
    { href: '/messages', label: 'Letters', sub: 'Messages' },
    { href: '/companion-profile', label: 'Mirror', sub: 'Profile' },
    { href: '/settings', label: 'Codex', sub: 'Settings' },
    { href: '/standing', label: 'Standing', sub: rhythm ? tier.label : 'Status' },
    { href: '/goals', label: 'Goals', sub: activeGoals.length ? `${activeGoals.length} active` : 'Direction' },
    { href: '#', label: 'Map', sub: 'Soon', disabled: true },
  ]

  return (
    <main className={`${styles.home} safe-bottom`}>
      <div className={styles.ambientGold} aria-hidden />
      <div className={styles.ambientBlue} aria-hidden />
      <div className={styles.embers} aria-hidden />

      <section className={styles.hero} aria-label="Player profile">
        <div className={styles.identityRow}>
          <div className={styles.crest} aria-hidden>
            <span className={styles.crestInitials}>MZ</span>
            <span className={styles.crestRank}>Purpose</span>
          </div>
          <div>
            <p className={styles.eyebrow}>Mythic Life</p>
            <h1 className={styles.name}>Mark Zito</h1>
            <p className={styles.subtitle}>The Unconventional Advisor</p>
          </div>
        </div>

        <div className={styles.resourceRow}>
          <Link href="/today" className={styles.resource}>
            <span className={styles.resourceOrb}>Q</span>
            <span className={styles.resourceText}>
              <span className={styles.resourceValue}>
                {focusDone}/{focusTotal || '—'}
              </span>
              <span className={styles.resourceLabel}>Today</span>
            </span>
          </Link>
          <div className={styles.resource}>
            <span className={styles.resourceOrb}>R</span>
            <span className={styles.resourceText}>
              <span className={styles.resourceValue}>{rhythm ? tier.label : '—'}</span>
              <span className={styles.resourceLabel}>Rhythm</span>
            </span>
          </div>
          <div className={styles.resource}>
            <span className={styles.resourceOrb}>F</span>
            <span className={styles.resourceText}>
              <span className={styles.resourceValue}>{bestStreak || '—'}</span>
              <span className={styles.resourceLabel}>Streak</span>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.rankPanel} aria-label="Rank and daily progress">
        <div className={styles.rankCopy}>
          <p className={styles.eyebrow}>Current mantle</p>
          <h2 className={styles.rankTitle}>Knight of Purpose</h2>
          <p className={styles.rankMeta}>Rank III</p>
          <p className={styles.vow}>
            Whatever you do, do it all for the glory of God.
            <span className={styles.scripture}>1 Corinthians 10:31</span>
          </p>
        </div>
        <div
          className={styles.progressRing}
          style={{ '--progress': `${focusPct}%` } as CSSProperties}
          aria-label={`${focusPct}% of today's focus complete`}
        >
          <div>
            <p className={styles.progressValue}>{focusPct}%</p>
            <p className={styles.progressLabel}>Today</p>
          </div>
        </div>
      </section>

      <div className={styles.stack}>
        {feedback && <FeedbackBanners feedback={feedback} />}

        {!musterClaimed && (
          <div className={styles.systemInset}>
            <MusterCard
              claimed={false}
              streak={standingRow.muster_streak || 0}
              dateCoins={standingRow.date_coins || 0}
              action={claimDailyMuster}
            />
          </div>
        )}

        <Link href="/today" className={styles.featureCard}>
          <div className={styles.featureContent}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardKicker}>What&apos;s next</p>
                <p className={styles.cardTitle}>
                  {focusOpen === 0
                    ? 'The board is clear. Choose the next worthy thing.'
                    : `${focusOpen} quest${focusOpen === 1 ? '' : 's'} await your hand.`}
                </p>
                <p className={styles.cardSub}>Routine · Must-dos · Master List</p>
              </div>
              <span className={styles.questBadge}>{focusOpen}</span>
            </div>
          </div>
        </Link>

        <Link href="/goals" className={styles.goalsCard}>
          <div className={styles.goalsContent}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardKicker}>Long campaigns</p>
                <p className={styles.cardTitle}>Active Goals</p>
              </div>
              <span className={styles.arrow}>›</span>
            </div>

            {topGoals.length === 0 ? (
              <p className={styles.emptyText}>No active goals. Name the direction before chasing speed.</p>
            ) : (
              <div className={styles.goalList}>
                {topGoals.map((g) => {
                  const pct =
                    g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0
                  return (
                    <div className={styles.goalRow} key={g.id}>
                      <span className={styles.goalSigil} aria-hidden>
                        {PILLAR_SIGIL[g.pillar] || '✦'}
                      </span>
                      <p className={styles.goalName}>{g.title}</p>
                      <span className={styles.goalCount}>
                        {g.progress}/{g.target}
                      </span>
                      <div className={styles.goalTrack}>
                        <div className={styles.goalFill} style={{ width: `${pct}%` }} />
                      </div>
                      <p className={styles.goalMeta}>
                        {PILLAR_LABELS[g.pillar]} · {g.horizon}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Link>

        <Link href="/standing" className={styles.standingCard}>
          <div className={styles.standingContent}>
            <div className={styles.standingRow}>
              <div>
                <p className={styles.cardKicker}>World standing</p>
                {rhythm ? (
                  <p className={`${styles.cardTitle} ${tier.color}`}>
                    Rhythm · {tier.label}
                    {standingRow.baseline_phase ? ` · Phase ${standingRow.baseline_phase}` : ''}
                  </p>
                ) : (
                  <p className={styles.cardTitle}>Self · Consistency · Shadow Debt</p>
                )}
                <p className={styles.cardSub}>Your condition changes how the world answers.</p>
              </div>
              <span className={styles.standingSeal}>III</span>
            </div>
          </div>
        </Link>
      </div>

      <div className={styles.sectionHeading}>
        <span className={styles.sectionHeadingText}>The Grimoire</span>
      </div>

      <section className={styles.moduleGrid} aria-label="Game modules">
        {modules.map((m) => {
          const Icon = MODULE_ICONS[m.label]
          const content = (
            <div className={styles.moduleContent}>
              <div className={styles.iconHalo}>
                <Icon size={27} />
              </div>
              <p className={styles.moduleName}>{m.label}</p>
              <p className={styles.moduleSub}>{m.sub}</p>
            </div>
          )

          return m.disabled ? (
            <div
              key={m.label}
              className={`${styles.moduleCard} ${styles.moduleDisabled}`}
              aria-disabled="true"
            >
              {content}
            </div>
          ) : (
            <Link key={m.label} href={m.href} className={styles.moduleCard}>
              {content}
            </Link>
          )
        })}
      </section>
    </main>
  )
}
