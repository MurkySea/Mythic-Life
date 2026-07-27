import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import Link from 'next/link'
import { ensureRecurringTasks } from './actions'
import { completeTask } from './complete-task'
import { maybeCompanionCheckIn } from './check-in-actions'
import { claimDailyMuster } from './muster-actions'
import { readFeedback } from '@/lib/feedback'
import { PendingCircleButton } from '@/components/PendingSubmit'
import FeedbackBanners from '@/components/FeedbackBanners'
import MusterCard from '@/components/MusterCard'
import { Plate, TileIcon, QuestRow } from '@/components/FantasyFrame'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'
import { loadStanding } from '@/lib/engines/standing-store'
import { chicagoYmd } from '@/lib/engines/muster'
import type { ModuleIconKey } from '@/components/MythicIcons'

export const dynamic = 'force-dynamic'

function formatAnchor(time: string | null | undefined): string | null {
  if (!time || typeof time !== 'string') return null
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return time
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

function anchorMinutes(time: string | null | undefined): number {
  if (!time) return 9999
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return 9999
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
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
  const [standingUi, standingRow] = await Promise.all([
    fetchLatestStanding(),
    loadStanding(),
  ])
  const supabase = await createClient()

  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_today', true)
    .order('created_at', { ascending: true })

  const incompleteTasks = (todayTasks?.filter((t) => !t.is_completed) || []).slice().sort((a, b) => {
    const ta = anchorMinutes(a.anchor_time)
    const tb = anchorMinutes(b.anchor_time)
    if (ta !== tb) return ta - tb
    return 0
  })
  const completedTasks = todayTasks?.filter((t) => t.is_completed) || []
  const totalToday = (todayTasks || []).length
  const doneToday = completedTasks.length
  const bestStreak = Math.max(
    0,
    ...(todayTasks || []).map((t: { streak_count?: number }) => t.streak_count || 0)
  )

  const rhythm = standingUi?.rhythm
  const tier = tierStyle(rhythm?.tier)

  const today = chicagoYmd()
  const musterClaimed = standingRow.last_muster_date === today

  const modules: { href: string; label: ModuleIconKey; sub: string; disabled?: boolean }[] = [
    { href: '/tasks', label: 'Quests', sub: 'Task log' },
    { href: '/skills', label: 'Skills', sub: 'Growth' },
    { href: '/companions', label: 'Party', sub: 'Allies' },
    { href: '/messages', label: 'Letters', sub: 'Messages' },
    { href: '/companion-profile', label: 'Mirror', sub: 'Profile' },
    { href: '/settings', label: 'Codex', sub: 'Settings' },
    { href: '/standing', label: 'Standing', sub: rhythm ? tier.label : 'Status' },
    { href: '/goals', label: 'Goals', sub: 'Direction' },
    { href: '#', label: 'Map', sub: 'Soon', disabled: true },
  ]

  return (
    <main className="max-w-md mx-auto px-4 pt-5 space-y-4 safe-bottom">
      <Plate gold className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-0.5">
            <p className="ml-kicker">Mythic Life</p>
            <h1 className="ml-title mt-1 text-[1.35rem]">Mark Zito</h1>
            <p className="mt-1.5 text-[11px] font-medium text-muted">The Unconventional Advisor</p>
          </div>
          {bestStreak > 0 && (
            <div className="orb orb-gold shrink-0">
              <span className="text-[7px] font-bold tracking-wider uppercase opacity-70">Streak</span>
              <span className="text-sm font-bold font-display">{bestStreak}</span>
            </div>
          )}
        </div>
      </Plate>

      {feedback && <FeedbackBanners feedback={feedback} />}

      <div className="progress-strip">
        <div>
          <p className="progress-strip-label">Today's progress</p>
          <p className="text-[11px] text-muted mt-0.5">
            {doneToday === 0 && totalToday === 0
              ? 'No quests on the board'
              : doneToday === totalToday && totalToday > 0
                ? 'All quests complete'
                : `${totalToday - doneToday} remaining`}
          </p>
        </div>
        <span className="progress-strip-value">
          {doneToday}
          <span className="text-dim text-base font-semibold">/{totalToday || '—'}</span>
        </span>
      </div>

      <MusterCard
        claimed={musterClaimed}
        streak={standingRow.muster_streak || 0}
        dateCoins={standingRow.date_coins || 0}
        action={claimDailyMuster}
      />

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="section-label">Today's quests</h2>
          <Link href="/mother-list" className="text-xs font-semibold text-gold">
            + Mother List
          </Link>
        </div>

        {incompleteTasks.length > 0 ? (
          <div className="space-y-2">
            {incompleteTasks.slice(0, 6).map(
              (task: {
                id: string
                title: string
                streak_count?: number
                anchor_time?: string
              }) => {
                const timeLabel = formatAnchor(task.anchor_time)
                return (
                  <QuestRow key={task.id}>
                    <form action={completeTask} className="shrink-0">
                      <input type="hidden" name="id" value={task.id} />
                      <PendingCircleButton />
                    </form>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="quest-row-title truncate">{task.title}</p>
                        {timeLabel && <span className="quest-row-time">{timeLabel}</span>}
                      </div>
                      {(task.streak_count || 0) >= 2 && (
                        <p className="quest-row-streak">{task.streak_count} day streak</p>
                      )}
                    </div>
                  </QuestRow>
                )
              }
            )}
          </div>
        ) : (
          <div className="quest-row justify-center py-8">
            <p className="text-sm font-medium text-muted text-center">
              {completedTasks.length > 0 ? 'All quests complete for today.' : 'No quests on the board.'}
            </p>
          </div>
        )}
      </section>

      <Link href="/standing" className="block">
        <Plate gold className="px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="ml-kicker">Standing</p>
              {rhythm ? (
                <p className={`font-display text-[14px] font-semibold mt-1 ${tier.color}`}>
                  Rhythm · {tier.label}
                </p>
              ) : (
                <p className="text-sm font-medium mt-1 text-muted">Self · Consistency · Shadow Debt</p>
              )}
            </div>
            <span className="text-dim text-lg opacity-70">→</span>
          </div>
        </Plate>
      </Link>

      <section className="section-quiet pt-1">
        <p className="section-label mb-2.5 px-1">Grimoire</p>
        <div className="grid grid-cols-3 gap-2.5">
          {modules.map((m) =>
            m.disabled ? (
              <div key={m.label} className="grimoire-tile p-3 opacity-30 flex flex-col items-center">
                <TileIcon label={m.label} icon={m.label} />
                <span className="text-[9px] mt-0.5 text-dim">{m.sub}</span>
              </div>
            ) : (
              <Link
                key={m.label}
                href={m.href}
                className="grimoire-tile p-3 flex flex-col items-center gap-0.5"
              >
                <TileIcon label={m.label} icon={m.label} />
                <span className="text-[9px] mt-0.5 text-muted">{m.sub}</span>
              </Link>
            )
          )}
        </div>
      </section>
    </main>
  )
}
