import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function addTask(formData: FormData) {
  'use server'
  
  const title = formData.get('title') as string
  const notes = formData.get('notes') as string
  const domain = formData.get('domain') as string
  const recurrence = (formData.get('recurrence') as string) || 'none'

  if (!title?.trim()) return

  const supabase = await createClient()

  // If the task is daily, put it on Today immediately
  const isToday = recurrence === 'daily'

  await supabase.from('tasks').insert({
    title: title.trim(),
    notes: notes?.trim() || null,
    domain: domain || null,
    recurrence: recurrence,
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

  await supabase
    .from('tasks')
    .update({ is_today: !currentlyToday })
    .eq('id', id)

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
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
      {/* Header with back button */}
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

      {/* Add new task form */}
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
        <select
          name="domain"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
        >
          <option value="">Domain (optional)</option>
          <option value="faith">Faith</option>
          <option value="discipline">Discipline</option>
          <option value="stewardship">Stewardship</option>
          <option value="wisdom">Wisdom</option>
          <option value="fitness">Fitness</option>
          <option value="relations">Relations</option>
          <option value="business">Business</option>
          <option value="knowledge">Knowledge</option>
        </select>

        {/* NEW: Recurrence selector */}
        <select
          name="recurrence"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>

        <button
          type="submit"
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl transition"
        >
          Add to Mother List
        </button>
      </form>

      {/* Task list */}
      <div className="space-y-2">
        {tasks && tasks.length > 0 ? (
          tasks.map((task: any) => (
            <div
              key={task.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-white">{task.title}</p>
                  {task.notes && (
                    <p className="text-zinc-500 text-sm mt-0.5">{task.notes}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {task.domain && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {task.domain}
                      </span>
                    )}
                    {task.is_today && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300">
                        Today
                      </span>
                    )}
                    {/* NEW: Recurrence badge */}
                    {task.recurrence && task.recurrence !== 'none' && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                        {task.recurrence}
                      </span>
                    )}
                  </div>
                </div>
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
          ))
        ) : (
          <div className="text-center py-12 text-zinc-500 text-sm">
            Your Mother List is empty. Add the first task above.
          </div>
        )}
      </div>
    </main>
  )
}
