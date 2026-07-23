import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SKILLS, SKILL_LABELS } from '@/lib/skills'

export const dynamic = 'force-dynamic'

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

async function updateTask(formData: FormData) {
  'use server'

  const id = formData.get('id') as string
  if (!id) return

  const title = (formData.get('title') as string) || ''
  const notes = (formData.get('notes') as string) || ''
  const domainsRaw = formData.getAll('domains') as string[]
  const domains = domainsRaw.length > 0 ? domainsRaw.join(',') : null
  const domain = domainsRaw[0] || null
  const recurrence = (formData.get('recurrence') as string) || 'none'
  const weekdaysRaw = formData.getAll('weekdays') as string[]
  const weekdays =
    recurrence === 'weekly' && weekdaysRaw.length > 0 ? weekdaysRaw.join(',') : null
  const anchorRaw = (formData.get('anchor_time') as string) || ''
  const anchor_time = /^\d{1,2}:\d{2}$/.test(anchorRaw.trim()) ? anchorRaw.trim() : null
  const addToToday = formData.get('add_to_today') === 'on'

  if (!title.trim()) return

  let isToday = addToToday
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
    isToday = weekdays.split(',').includes(todayKey) || addToToday
  }

  const supabase = await createClient()
  await supabase
    .from('tasks')
    .update({
      title: title.trim(),
      notes: notes.trim() || null,
      domain,
      domains,
      recurrence,
      weekdays,
      anchor_time,
      is_today: isToday,
    })
    .eq('id', id)

  revalidatePath('/mother-list')
  revalidatePath('/')
  revalidatePath('/tasks')
  redirect('/mother-list')
}

export default async function TaskEditPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6 pb-24">
        <h1 className="text-xl text-white pt-8">Edit task</h1>
        <p className="text-zinc-500 text-sm mt-2">Supabase env vars missing.</p>
      </main>
    )
  }

  const params = await searchParams
  const id = params.id
  if (!id) {
    redirect('/mother-list')
  }

  const supabase = await createClient()
  const { data: task } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()

  if (!task) {
    redirect('/mother-list')
  }

  const selectedDomains = new Set(
    String(task.domains || task.domain || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
  )
  const selectedDays = new Set(
    String(task.weekdays || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
  )

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-28">
      <div className="pt-4 flex items-center gap-3">
        <Link
          href="/mother-list"
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div>
          <p className="text-zinc-500 text-sm">Master List</p>
          <h1 className="text-2xl font-medium text-white">Edit task</h1>
        </div>
      </div>

      <form action={updateTask} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <input type="hidden" name="id" value={task.id} />

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Title</p>
          <input
            type="text"
            name="title"
            defaultValue={task.title || ''}
            required
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Notes</p>
          <input
            type="text"
            name="notes"
            defaultValue={task.notes || ''}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Domains</p>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <label
                key={s}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 cursor-pointer has-[:checked]:border-violet-500 has-[:checked]:bg-violet-600/20 has-[:checked]:text-violet-200"
              >
                <input
                  type="checkbox"
                  name="domains"
                  value={s}
                  defaultChecked={selectedDomains.has(s)}
                  className="sr-only"
                />
                {SKILL_LABELS[s]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Repeat</p>
          <select
            name="recurrence"
            defaultValue={task.recurrence || 'none'}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Weekly days</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label
                key={d}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 cursor-pointer has-[:checked]:border-violet-500 has-[:checked]:bg-violet-600/20 has-[:checked]:text-violet-200"
              >
                <input
                  type="checkbox"
                  name="weekdays"
                  value={d}
                  defaultChecked={selectedDays.has(d)}
                  className="sr-only"
                />
                {WEEKDAY_LABELS[d]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Time (Chicago)</p>
          <input
            type="time"
            name="anchor_time"
            defaultValue={task.anchor_time || ''}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
          />
        </div>

        <label className="flex items-center gap-3 px-1 py-1 cursor-pointer">
          <input
            type="checkbox"
            name="add_to_today"
            defaultChecked={!!task.is_today}
            className="rounded border-zinc-600 bg-zinc-950 text-violet-600"
          />
          <span className="text-sm text-zinc-300">On Today</span>
        </label>

        <button
          type="submit"
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3.5 rounded-xl transition"
        >
          Save changes
        </button>
      </form>
    </main>
  )
}
