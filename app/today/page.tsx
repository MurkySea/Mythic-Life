import Link from 'next/link'
import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { ensureRecurringTasks } from '@/app/actions'
import TaskLane from '@/components/TaskLane'
import { MUST_DO_CAP, splitTaskLanes, type TaskRow } from '@/lib/task-lanes'

export const dynamic = 'force-dynamic'

function chicagoDateLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date())
}

export default async function TodayPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6">
        <h1 className="text-xl text-white pt-8">Today</h1>
        <p className="text-zinc-500 text-sm mt-2">Supabase env missing.</p>
      </main>
    )
  }

  await ensureRecurringTasks()

  const supabase = await createClient()
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (allTasks || []) as TaskRow[]
  const { routine, mustDos, master } = splitTaskLanes(rows)

  const focusOpen = routine.length + mustDos.length

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors mb-3"
        >
          ← Home
        </Link>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-zinc-500 text-xs tracking-wide uppercase">Focus</p>
            <h1 className="text-2xl font-medium text-white tracking-tight">Today</h1>
            <p className="text-zinc-500 text-sm mt-1">{chicagoDateLabel()}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">Open focus</p>
            <p className="text-lg font-medium text-white tabular-nums">{focusOpen}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Link
          href="/mother-list"
          className="flex-1 text-center text-xs py-2 rounded-lg border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 transition"
        >
          Plan / Master list
        </Link>
        <Link
          href="/task-generator"
          className="flex-1 text-center text-xs py-2 rounded-lg border border-violet-800/50 bg-violet-950/30 text-violet-300 hover:border-violet-600 transition"
        >
          + New task
        </Link>
      </div>

      <div className="space-y-6">
        <TaskLane
          label="Must-dos"
          hint={`${mustDos.length}/${MUST_DO_CAP}`}
          tasks={mustDos}
          empty="Pull up to 5 one-time tasks onto Today from Plan."
          accent="gold"
        />

        {master.length > 0 && (
          <>
            <TaskLane
              label="Master list"
              hint={`${master.length} open`}
              tasks={master.slice(0, 12)}
              empty="Master list is clear."
              accent="violet"
            />
            {master.length > 12 && (
              <Link
                href="/mother-list"
                className="block text-center text-xs text-zinc-500 hover:text-violet-400 py-1 -mt-3"
              >
                View all {master.length} on Master List →
              </Link>
            )}
          </>
        )}

        <TaskLane
          label="Routine"
          hint={routine.length ? `${routine.length}` : undefined}
          tasks={routine}
          empty="No recurring tasks scheduled today."
          accent="zinc"
        />

        {/* Calendar — reserved for Google / Apple calendar connection */}
        <section className="space-y-2 pt-2">
          <div className="flex items-baseline justify-between px-1 gap-2">
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-sky-400/80">
              Calendar
            </h2>
            <span className="text-[10px] text-zinc-600">soon</span>
          </div>
          <div className="rounded-xl border border-dashed border-zinc-800/80 px-4 py-5">
            <p className="text-xs text-zinc-600 text-center leading-relaxed">
              Appointments and events will land here once a calendar is connected.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
