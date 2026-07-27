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
import { MUST_DO_CAP, splitTaskLanes, type TaskRow } from '@/lib/task-lanes'
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

function TaskLane({
  label,
  hint,
  tasks,
  empty,
  accent,
}: {
  label: string
  hint?: string
  tasks: TaskRow[]
  empty?: string
  accent?: 'gold' | 'violet' | 'zinc'
}) {
  const kicker =
    accent === 'gold'
      ? 'text-amber-400/90'
      : accent === 'violet'
        ? 'text-violet-400/90'
        : 'text-zinc-500'

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1 gap-2">
        <h2 className={`section-label ${kicker}`}>{label}</h2>
        {hint && <span className="text-[10px] text-zinc-600 tabular-nums">{hint}</span>}
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task) => {
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
          })}
        </div>
      ) : (
        empty && (
          <div className="rounded-xl border border-dashed border-zinc-800/80 px-4 py-4">
            <p className="text-xs text-zinc-600 text-center">{empty}</p>
          </div>
        )
      )}
    </section>
  )
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

  // Pull open + today's completed so progress is accurate; lanes use incomplete only
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (allTasks || []) as TaskRow[]
  const { routine, mustDos, master } = splitTaskLanes(rows)

  // Progress = routine + must-dos (the committed day), not the whole master backlog
  const focusPool = rows.filter((t) => {
    if (t.is_completed) {
      // count completed today-ish focus items
      return t.is_today || t.must_do || isRecurringToday(t)
    }
    return false
  })
  const focusOpen = routine.length + mustDos.length
  const focusDone = focusPool.length
  const focusTotal = focusOpen + focusDone

  const bestStreak = Math.max(
    0,
    ...rows.map((t) => t.streak_count || 0)
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
          <div className="flex items-start gap-2 shrink-0">
            <div
              className="orb shrink-0"
              title={
                focusTotal === 0
                  ? 'No focus tasks'
                  : focusOpen === 0
                    ? 'Focus complete'
                    : `${focusOpen} remaining`
              }
              style={{
                background:
                  focusTotal > 0 && focusOpen === 0
                    ? 'linear-gradient(160deg, rgba(52, 211, 153, 0.22) 0%, rgba(16, 24, 20, 0.9) 100%)'
                    : undefined,
                borderColor:
                  focusTotal > 0 && focusOpen === 0
                    ? 'rgba(52, 211, 153, 0.4)'
                    : undefined,
              }}
            >
              <span className="text-[7px] font-bold tracking-wider uppercase opacity-70">Today</span>
              <span className="text-sm font-bold font-display tabular-nums">
                {focusDone}
                <span className="text-[10px] opacity-60 font-semibold">/{focusTotal || '—'}</span>
              </span>
            </div>
            {bestStreak > 0 && (
              <div className="orb orb-gold shrink-0">
                <span className="text-[7px] font-bold tracking-wider uppercase opacity-70">Streak</span>
                <span className="text-sm font-bold font-display">{bestStreak}</span>
              </div>
            )}
          </div>
        </div>
      </Plate>

      {feedback && <FeedbackBanners feedback={feedback} />}

      {!musterClaimed && (
        <MusterCard
          claimed={false}
          streak={standingRow.muster_streak || 0}
          dateCoins={standingRow.date_coins || 0}
          action={claimDailyMuster}
        />
      )}

      {/* ── Today lanes ───────────────────────────────────── */}
      <div className="space-y-5">
        <div className="flex items-center justify-between px-1">
          <h2 className="section-label text-zinc-300">Today</h2>
          <Link href="/mother-list" className="text-xs font-semibold text-gold">
            + Plan
          </Link>
        </div>

        <TaskLane
          label="Routine"
          hint={routine.length ? `${routine.length}` : undefined}
          tasks={routine}
          empty="No recurring tasks scheduled today."
          accent="zinc"
        />

        <TaskLane
          label="Must-dos"
          hint={`${mustDos.length}/${MUST_DO_CAP}`}
          tasks={mustDos}
          empty="Pull up to 5 one-time tasks onto Today from the Master List."
          accent="gold"
        />

        <TaskLane
          label="Master list"
          hint={master.length ? `${master.length} open` : undefined}
          tasks={master.slice(0, 8)}
          empty="Master list is clear."
          accent="violet"
        />

        {master.length > 8 && (
          <Link
            href="/mother-list"
            className="block text-center text-xs text-zinc-500 hover:text-violet-400 py-1"
          >
            View all {master.length} on Master List →
          </Link>
        )}
      </div>

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

function isRecurringToday(t: TaskRow): boolean {
  const r = (t.recurrence || '').toLowerCase()
  return (r === 'daily' || r === 'weekly') && !!t.is_today
}
