import Link from 'next/link'
import { PILLAR_LABELS } from '@/lib/engines/goals'
import { createGoalAction } from '../actions'

export const dynamic = 'force-dynamic'

const PILLARS = Object.entries(PILLAR_LABELS) as [string, string][]

const HORIZONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'season', label: 'Season' },
  { id: 'ongoing', label: 'Ongoing' },
]

const ERR: Record<string, string> = {
  title: 'Give the goal a clear title.',
  pillar: 'Pick a pillar.',
  horizon: 'Pick a horizon.',
  save: 'Could not save — check the goals table exists in Supabase.',
}

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>
}) {
  const params = await searchParams
  const err = params.err ? ERR[params.err] || 'Something went wrong.' : null

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/goals"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div>
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Direction</p>
          <h1 className="text-xl font-medium text-white tracking-tight">New goal</h1>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {err}
        </div>
      )}

      <form action={createGoalAction} className="space-y-5">
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Title
          </label>
          <input
            name="title"
            required
            placeholder="e.g. 12 client review calls this month"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-600"
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Pillar
          </label>
          <select
            name="pillar"
            defaultValue="stewardship"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:outline-none focus:border-violet-600"
          >
            {PILLARS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
              Horizon
            </label>
            <select
              name="horizon"
              defaultValue="weekly"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:outline-none focus:border-violet-600"
            >
              {HORIZONS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
              Weight (1–5)
            </label>
            <select
              name="weight"
              defaultValue="3"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:outline-none focus:border-violet-600"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Target count
          </label>
          <input
            name="target"
            type="number"
            min={1}
            defaultValue={4}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white focus:outline-none focus:border-violet-600"
          />
          <p className="text-[11px] text-zinc-600 mt-1.5">
            How many units until complete (calls, weeks, nights, sessions…).
          </p>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Notes <span className="normal-case text-zinc-600">(optional)</span>
          </label>
          <textarea
            name="notes"
            rows={3}
            placeholder="Why this matters…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-600 resize-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium py-3.5 transition active:scale-[0.98]"
        >
          Set goal
        </button>
      </form>
    </main>
  )
}
