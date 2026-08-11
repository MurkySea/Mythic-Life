import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { SKILLS, SKILL_LABELS } from '@/lib/skills'
import { updateTaskAction } from '@/app/task-actions'

export const dynamic = 'force-dynamic'

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) return <main className="max-w-md mx-auto p-6 text-white">Supabase environment configuration is missing.</main>

  const { id } = await params
  const supabase = await createClient()
  const { data: task, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
  if (error || !task) notFound()

  const selectedDomains = new Set(String(task.domains || task.domain || '').split(',').map((v: string) => v.trim()).filter(Boolean))
  const selectedWeekdays = new Set(String(task.weekdays || '').split(',').map((v: string) => v.trim()).filter(Boolean))

  async function save(formData: FormData) {
    'use server'
    const result = await updateTaskAction(id, formData)
    if (!result.ok) redirect(`/tasks/${id}/edit?error=${encodeURIComponent(result.error)}`)
    redirect('/today')
  }

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-28">
      <div className="pt-4 flex items-center gap-3">
        <Link href="/today" className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600">←</Link>
        <div><p className="text-zinc-500 text-sm">Task</p><h1 className="text-2xl font-medium text-white">Edit task</h1></div>
      </div>

      <form action={save} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Title</p>
          <input name="title" defaultValue={task.title || ''} required className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500" />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Notes</p>
          <input name="notes" defaultValue={task.notes || ''} className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Domains</p>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((skill) => (
              <label key={skill} className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 cursor-pointer has-[:checked]:border-violet-500 has-[:checked]:bg-violet-600/20 has-[:checked]:text-violet-200">
                <input type="checkbox" name="domains" value={skill} defaultChecked={selectedDomains.has(skill)} className="sr-only" />
                {SKILL_LABELS[skill]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Repeat</p>
          <select name="recurrence" defaultValue={task.recurrence || 'none'} className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300">
            <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Weekly days</p>
          <div className="flex flex-wrap gap-2">
            {(['mon','tue','wed','thu','fri','sat','sun'] as const).map((day) => (
              <label key={day} className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 cursor-pointer has-[:checked]:border-violet-500 has-[:checked]:bg-violet-600/20 has-[:checked]:text-violet-200">
                <input type="checkbox" name="weekdays" value={day} defaultChecked={selectedWeekdays.has(day)} className="sr-only" />{WEEKDAY_LABELS[day]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Time</p>
          <input type="time" name="anchor_time" defaultValue={task.anchor_time || ''} className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300" />
        </div>

        <label className="flex items-center gap-3 px-1 py-1 cursor-pointer">
          <input type="checkbox" name="add_to_today" defaultChecked={Boolean(task.is_today)} className="rounded border-zinc-600 bg-zinc-950 text-violet-600" />
          <span className="text-sm text-zinc-300">Show on Today</span>
        </label>

        <button type="submit" className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3.5 rounded-xl transition">Save changes</button>
      </form>
    </main>
  )
}
