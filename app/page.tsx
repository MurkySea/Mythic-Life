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
import { Plate, TileIcon } from '@/components/FantasyFrame'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'
import { loadStanding } from '@/lib/engines/standing-store'
import { chicagoYmd } from '@/lib/engines/muster'
import { splitTaskLanes, type TaskRow } from '@/lib/task-lanes'
import type { ModuleIconKey } from '@/components/MythicIcons'
import { listGoals, PILLAR_LABELS } from '@/lib/engines/goals-store'
import type { GoalPillar } from '@/lib/engines/goals'

export const dynamic = 'force-dynamic'

const PILLAR_EMOJI: Record<GoalPillar, string> = {
  stewardship: '💼',
  faith: '✝️',
  marriage: '💍',
  body: '🏃',
  homestead: '🏡',
  legacy: '🏛️',
  self: '🎹',
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
    <main className="max-w-md mx-auto px-4 pt-5 space-y-4 safe-bottom">
      <Plate gold className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-0.5">
            <p className="ml-kicker">Mythic Life</p>
            <h1 className="ml-title mt-1 text-[1.35rem]">Mark Zito</h1>
            <p className="mt-1.5 text-[11px] font-medium text-muted">The Unconventional Advisor</p>
          </div>
          <div className="flex items-start gap-2 shrink-0">
            <Link href="/today" className="orb shrink-0" title="Open Today">
              <span className="text-[7px] font-bold tracking-wider uppercase opacity-70">Today</span>
              <span className="text-sm font-bold font-display tabular-nums">
                {focusDone}
                <span className="text-[10px] opacity-60 font-semibold">/{focusTotal || '—'}</span>
              </span>
            </Link>
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

      {/* Today entry — full board lives on /today */}
      <Link href="/today" className="block">
        <Plate emphasis className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="ml-kicker text-violet">Today</p>
              <p className="mt-1 text-[15px] font-semibold text-white">
                {focusOpen === 0
                  ? 'Focus clear — open the board'
                  : `${focusOpen} open · Routine · Must-dos`}
              </p>
              <p className="text-[11px] text-muted mt-1">
                Tasks · calendar (soon) · plan from Master List
              </p>
            </div>
            <span className="text-dim text-lg opacity-70">→</span>
          </div>
        </Plate>
      </Link>

      {/* Active goals strip */}
      <Link href="/goals" className="block">
        <Plate className="px-5 py-3.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="ml-kicker">Goals</p>
            <span className="text-[11px] text-muted">
              {activeGoals.length === 0
                ? 'Set direction →'
                : `${activeGoals.length} active →`}
            </span>
          </div>
          {topGoals.length === 0 ? (
            <p className="text-sm text-muted">No active goals. Weight what matters.</p>
          ) : (
            <div className="space-y-2.5">
              {topGoals.map((g) => {
                const pct =
                  g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0
                return (
                  <div key={g.id}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm shrink-0" aria-hidden>
                        {PILLAR_EMOJI[g.pillar] || '🎯'}
                      </span>
                      <p className="text-[13px] text-white truncate flex-1">{g.title}</p>
                      <span className="text-[10px] text-dim tabular-nums shrink-0">
                        {g.progress}/{g.target}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-dim mt-0.5">
                      {PILLAR_LABELS[g.pillar]} · {g.horizon}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Plate>
      </Link>

      <Link href="/standing" className="block">
        <Plate gold className="px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="ml-kicker">Standing</p>
              {rhythm ? (
                <p className={`font-display text-[14px] font-semibold mt-1 ${tier.color}`}>
                  Rhythm · {tier.label}
                  {standingRow.baseline_phase
                    ? ` · Phase ${standingRow.baseline_phase}`
                    : ''}
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
