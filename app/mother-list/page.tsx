import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { SKILLS, SKILL_LABELS } from '@/lib/skills'

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

async function addTask(formData: FormData) {
  'use server'

  const title = formData.get('title') as string
  const notes = formData.get('notes') as string
  const domainsRaw = formData.getAll('domains') as string[]
  const domains = domainsRaw.length > 0 ? domainsRaw.join(',') : null
  const domain = domainsRaw[0] || null
  const recurrence = (formData.get('recurrence') as string) || 'none'
  const weekdaysRaw = formData.getAll('weekdays') as string[]
  const weekdays =
    recurrence === 'weekly' && weekdaysRaw.length > 0 ? weekdaysRaw.join(',') : null

  if (!title?.trim()) return

  const supabase = await createClient()

  let isToday = false
  if (recurrence === 'daily') {
    isToday = true
  } else if (recurrence === 'weekly' && weekdays) {
    const todayKey = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
    })
      .format(new Date())
      .toLowerCase()
      .slice(0, 3)
    isToday = weekdays.split(',').includes(todayKey)
  }

  await supabase.from('tasks').insert({
    title: title.trim(),
    notes: notes?.trim() || null,
    domain,
    domains,
    recurrence,
    weekdays,
    is_today: isToday,
    is_completed: false,
  })

  revalidatePath('/mother-list')
  revalidatePath('/')
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
        <h1 className="text-xl text-white pt-8">Mother List</h1>
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
    <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
      <div className="pt-4 flex items-center gap-3">
        <a
          href="/"
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition"
        >
          ←
        </a>
        <div>
          <p className="text-zinc-500 text-sm">All tasks</p>
          <h1 className="text-2xl font-medium text-white">Mother List</h1>
        </div>
      </div>

      <form action={addTask} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <input
          type="text"
          name="title"
          placeholder="What needs to be done?"
          required
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
        />
        <input
          type="text"
          name="notes"
          placeholder="Notes (optional)"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
        />

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Domains <span className="text-zinc-600 normal-case">(pick one or more)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <label
                key={s}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-violet-600 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-600/20 has-[:checked]:text-violet-200"
              >
                <input type="checkbox" name="domains" value={s} className="sr-only" />
                {SKILL_LABELS[s]}
              </label>
            ))}
          </div>
        </div>

        <select
          name="recurrence"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Weekly days <span className="text-zinc-600 normal-case">(if Weekly)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((d) => (
              <label
                key={d}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-violet-600 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-600/20 has-[:checked]:text-violet-200"
              >
                <input type="checkbox" name="weekdays" value={d} className="sr-only" />
                {WEEKDAY_LABELS[d]}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl transition"
        >
          Add to Mother List
        </button>
      </form>

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

              return (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <p className="font-medium text-white">{task.title}</p>
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
          <div className="text-center py-12 text-zinc-500 text-sm">
            Your Mother List is empty. Add the first task above.
          </div>
        )}
      </div>
    </main>
  )
}
