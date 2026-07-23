import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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
  const anchorRaw = (formData.get('anchor_time') as string) || ''
  const anchor_time = /^\d{1,2}:\d{2}$/.test(anchorRaw.trim()) ? anchorRaw.trim() : null
  const addToToday = formData.get('add_to_today') === 'on'

  if (!title?.trim()) {
    redirect('/task-generator?error=' + encodeURIComponent('Title is required.'))
  }

  const supabase = await createClient()

  // Surface mapping rules:
  // - Master List always receives every task (no filter).
  // - Today only receives tasks where is_today = true.
  // - Daily tasks always land on Today.
  // - Weekly tasks land on Today when today matches their weekdays, or when the
  //   user explicitly checks "Add to Today".
  // - One-off tasks land on Today only when the checkbox is checked.
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

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: title.trim(),
      notes: notes?.trim() || null,
      domain,
      domains,
      recurrence,
      weekdays,
      anchor_time,
      is_today: isToday,
      is_completed: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error('task insert failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })

    const msg =
      `Insert failed: ${error.message}` +
      (error.code ? ` [${error.code}]` : '') +
      (error.hint ? ` — ${error.hint}` : '') +
      '. Most common cause: RLS blocking anon INSERT on the tasks table.'

    redirect('/task-generator?error=' + encodeURIComponent(msg))
  }

  if (!data?.id) {
    redirect(
      '/task-generator?error=' +
        encodeURIComponent('Insert returned no row. Check RLS or table schema.')
    )
  }

  revalidatePath('/mother-list')
  revalidatePath('/task-generator')
  revalidatePath('/')
  revalidatePath('/tasks')

  redirect('/mother-list')
}

export default async function TaskGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6 pb-24">
        <h1 className="text-xl text-white pt-8">Task Generator</h1>
        <p className="text-zinc-500 text-sm mt-2">Supabase env vars missing on this deployment.</p>
      </main>
    )
  }

  const params = await searchParams
  const errorMessage = params.error ? decodeURIComponent(params.error) : null

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-28">
      <div className="pt-4 flex items-center gap-3">
        <Link
          href="/tasks"
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition"
        >
          ←
        </Link>
        <div>
          <p className="text-zinc-500 text-sm">Build a task</p>
          <h1 className="text-2xl font-medium text-white">Generator</h1>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/40 p-4">
          <p className="text-[11px] uppercase tracking-wider text-red-400 mb-1">Create failed</p>
          <p className="text-sm text-red-100 leading-relaxed break-words">{errorMessage}</p>
        </div>
      )}

      <p className="text-sm text-zinc-500 leading-relaxed px-0.5">
        Complexity lives here. Every task is written to the Master List. Check
        "Add to Today" (on by default) if you also want it on the Today surface.
      </p>

      <form action={addTask} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Title</p>
          <input
            type="text"
            name="title"
            placeholder="What needs to be done?"
            required
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Notes</p>
          <input
            type="text"
            name="notes"
            placeholder="Optional detail"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Domains <span className="text-zinc-600 normal-case">(one or more)</span>
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

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Repeat</p>
          <select
            name="recurrence"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Weekly days <span className="text-zinc-600 normal-case">(if weekly)</span>
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

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Time <span className="text-zinc-600 normal-case">(optional · Chicago)</span>
          </p>
          <input
            type="time"
            name="anchor_time"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
          />
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Companions may check in a few minutes after this time if the task is still open.
          </p>
        </div>

        <label className="flex items-center gap-3 px-1 py-1 cursor-pointer">
          <input
            type="checkbox"
            name="add_to_today"
            defaultChecked
            className="rounded border-zinc-600 bg-zinc-950 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-zinc-300">Add to Today</span>
        </label>

        <button
          type="submit"
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3.5 rounded-xl transition"
        >
          Create task
        </button>
      </form>

      <Link
        href="/mother-list"
        className="block text-center text-sm text-violet-400 hover:text-violet-300 py-2"
      >
        View Master List →
      </Link>
    </main>
  )
}
