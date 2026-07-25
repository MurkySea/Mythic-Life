import Link from 'next/link'
import { listGoals, PILLAR_LABELS } from '@/lib/engines/goals-store'
import type { Goal, GoalPillar } from '@/lib/engines/goals'
import {
  progressGoalAction,
  abandonGoalAction,
  pauseGoalAction,
  resumeGoalAction,
} from './actions'

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

function progressPct(g: Goal): number {
  if (g.target <= 0) return 0
  return Math.min(100, Math.round((g.progress / g.target) * 100))
}

function GoalCard({ goal }: { goal: Goal }) {
  const pct = progressPct(goal)
  const isActive = goal.status === 'active'
  const isPaused = goal.status === 'paused'
  const isDone = goal.status === 'completed'
  const isAbandoned = goal.status === 'abandoned'

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 ${
        isDone
          ? 'border-emerald-800/50 bg-emerald-950/20'
          : isAbandoned
            ? 'border-zinc-800 bg-zinc-900/40 opacity-70'
            : isPaused
              ? 'border-amber-800/40 bg-amber-950/10'
              : 'border-zinc-800 bg-zinc-900/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0" aria-hidden>
          {PILLAR_EMOJI[goal.pillar] || '🎯'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-white leading-snug">{goal.title}</p>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
              {goal.horizon}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {PILLAR_LABELS[goal.pillar]} · weight {goal.weight}/5
          </p>
          {goal.notes && (
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{goal.notes}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isAbandoned && (
        <div>
          <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
            <span>
              {goal.progress} / {goal.target}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isDone ? 'bg-emerald-500' : 'bg-violet-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {isActive && (
        <div className="flex flex-wrap gap-2 pt-1">
          <form action={progressGoalAction}>
            <input type="hidden" name="id" value={goal.id} />
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-500 transition"
            >
              + Progress
            </button>
          </form>
          <form action={pauseGoalAction}>
            <input type="hidden" name="id" value={goal.id} />
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 transition"
            >
              Pause
            </button>
          </form>
          <form action={abandonGoalAction}>
            <input type="hidden" name="id" value={goal.id} />
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:border-red-900 hover:text-red-400 transition"
            >
              Abandon
            </button>
          </form>
        </div>
      )}

      {isPaused && (
        <div className="flex flex-wrap gap-2 pt-1">
          <form action={resumeGoalAction}>
            <input type="hidden" name="id" value={goal.id} />
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-700/80 text-amber-100 font-medium hover:bg-amber-600 transition"
            >
              Resume
            </button>
          </form>
          <form action={abandonGoalAction}>
            <input type="hidden" name="id" value={goal.id} />
            <button
              type="submit"
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:border-red-900 hover:text-red-400 transition"
            >
              Abandon
            </button>
          </form>
        </div>
      )}

      {isDone && (
        <p className="text-xs text-emerald-400/90">
          Completed{goal.completedAt ? ` · ${goal.completedAt}` : ''}
        </p>
      )}
      {isAbandoned && <p className="text-xs text-zinc-600">Abandoned</p>}
    </div>
  )
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>
}) {
  const params = await searchParams
  const [active, paused, done, abandoned] = await Promise.all([
    listGoals({ status: 'active' }),
    listGoals({ status: 'paused' }),
    listGoals({ status: 'completed' }),
    listGoals({ status: 'abandoned' }),
  ])

  const history = [...done, ...abandoned].slice(0, 12)

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Direction</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Goals</h1>
        </div>
        <Link
          href="/goals/new"
          className="shrink-0 text-xs px-3 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition"
        >
          + New
        </Link>
      </div>

      {params.created === '1' && (
        <div className="mb-4 rounded-2xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          Goal set. Progress it when real work lands.
        </div>
      )}

      <p className="text-sm text-zinc-500 leading-relaxed mb-6">
        Goals sit above daily quests. Weight them. Complete them for Consistency Tokens.
        Abandon carefully — Shadow Debt follows neglect.
      </p>

      <section className="space-y-3 mb-8">
        <h2 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">Active</h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 px-5 py-10 text-center">
            <p className="text-sm text-zinc-500">No active goals.</p>
            <Link href="/goals/new" className="inline-block mt-3 text-sm text-violet-400">
              Set one →
            </Link>
          </div>
        ) : (
          active.map((g) => <GoalCard key={g.id} goal={g} />)
        )}
      </section>

      {paused.length > 0 && (
        <section className="space-y-3 mb-8">
          <h2 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">Paused</h2>
          {paused.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] uppercase tracking-wider text-zinc-500 px-1">History</h2>
          {history.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </section>
      )}
    </main>
  )
}
