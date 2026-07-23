import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

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

async function toggleToday(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const currentlyToday = formData.get('is_today') === 'true'
  const supabase = await createClient()
  await supabase.from('tasks').update({ is_today: !currentlyToday }).eq('id', id)
  revalidatePath('/mother-list')
  revalidatePath('/')
}

async function deleteTask(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  await supabase.from('tasks').delete().eq('id', id)
  revalidatePath('/mother-list')
  revalidatePath('/')
}

export default async function MotherListPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6 pb-24">
        <h1 className="text-xl text-white pt-8">Master List</h1>
        <p className="text-zinc-500 text-sm mt-2">Supabase env vars missing on this deployment.</p>
      </main>
    )
  }

  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-28">
      <div className="pt-4 flex items-center gap-3">
        <Link
          href="/tasks"
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-zinc-500 text-sm">All tasks</p>
          <h1 className="text-2xl font-medium text-white">Master List</h1>
        </div>
        <Link
          href="/task-generator"
          className="shrink-0 text-xs px-3 py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition"
        >
          + New
        </Link>
      </div>

      <p className="text-sm text-zinc-500 leading-relaxed">
        Browse and manage. Create complex tasks in the{' '}
        <Link href="/task-generator" className="text-violet-400 hover:text-violet-300">
          Generator
        </Link>
        .
      </p>

      <div className="space-y-2">
        {tasks && tasks.length > 0 ? (
          tasks.map(
            (task: {
              id: string
              title: string
              notes?: string
              weekdays?: string
              domains?: string
              domain?: string
              is_today?: boolean
              recurrence?: string
              anchor_time?: string
            }) => {
              const dayBadges =
                task.weekdays && typeof task.weekdays === 'string'
                  ? task.weekdays
                      .split(',')
                      .map((d: string) => WEEKDAY_LABELS[d.trim()] || d)
                      .join(' · ')
                  : null
              const domainList =
                task.domains || task.domain
                  ? String(task.domains || task.domain)
                      .split(',')
                      .map((d: string) => d.trim())
                      .filter(Boolean)
                  : []
              const timeLabel = formatAnchor(task.anchor_time)

              return (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-white">{task.title}</p>
                    {timeLabel && (
                      <span className="shrink-0 text-xs font-medium text-sky-300 tabular-nums">
                        {timeLabel}
                      </span>
                    )}
                  </div>
                  {task.notes && <p className="text-zinc-500 text-sm mt-0.5">{task.notes}</p>}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {domainList.map((d: string) => (
                      <span
                        key={d}
                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                      >
                        {d}
                      </span>
                    ))}
                    {task.is_today && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300">
                        Today
                      </span>
                    )}
                    {task.recurrence && task.recurrence !== 'none' && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                        {task.recurrence}
                        {dayBadges ? ` · ${dayBadges}` : ''}
                      </span>
                    )}
                    {timeLabel && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-900/40 text-sky-300">
                        {timeLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <form action={toggleToday}>
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="is_today" value={String(task.is_today)} />
                      <button
                        type="submit"
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          task.is_today
                            ? 'border-violet-600 bg-violet-600/20 text-violet-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}
                      >
                        {task.is_today ? 'Remove from Today' : 'Add to Today'}
                      </button>
                    </form>
                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        type="submit"
                        className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-500 hover:border-red-900 hover:text-red-400 transition"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              )
            }
          )
        ) : (
          <div className="text-center py-12 text-zinc-500 text-sm space-y-3">
            <p>Master List is empty.</p>
            <Link
              href="/task-generator"
              className="inline-block text-violet-400 hover:text-violet-300"
            >
              Open Task Generator →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
