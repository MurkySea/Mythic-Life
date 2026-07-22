import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import {
  ensureRecurringTasks,
  awardBondProgress,
  generateSeraphineResponse,
  updateTaskStreak,
} from './actions'

async function completeTask(formData: FormData) {
  'use server'

  const id = formData.get('id') as string
  const title = formData.get('title') as string
  const domain = formData.get('domain') as string

  const supabase = await createClient()

  await supabase
    .from('tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)

  const { streak } = await updateTaskStreak(id)
  await awardBondProgress(domain, streak)
  await generateSeraphineResponse(title, domain, { streak })

  revalidatePath('/')
  revalidatePath('/messages')
  revalidatePath('/companion')
  revalidatePath('/companion-profile')
}

export default async function TodayPage() {
  await ensureRecurringTasks()

  const supabase = await createClient()

  const { data: companion } = await supabase.from('companion').select('*').single()

  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_today', true)
    .order('created_at', { ascending: true })

  const incompleteTasks = todayTasks?.filter((t) => !t.is_completed) || []
  const completedTasks = todayTasks?.filter((t) => t.is_completed) || []

  const bestStreak = Math.max(0, ...(todayTasks || []).map((t: any) => t.streak_count || 0))

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
      <div className="pt-4 flex items-end justify-between">
        <div>
          <p className="text-zinc-500 text-sm">Good day, Mark</p>
          <h1 className="text-2xl font-medium text-white">Today</h1>
        </div>
        {bestStreak > 0 && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Best streak</p>
            <p className="text-lg font-medium text-amber-400">{bestStreak}🔥</p>
          </div>
        )}
      </div>

      {companion && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-violet-900/50 border border-violet-700 flex items-center justify-center text-xl">
              🦊
            </div>
            <div className="flex-1">
              <p className="text-violet-300 font-medium text-sm">{companion.name}</p>
              <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
                {incompleteTasks.length > 0
                  ? "I'm here. Let's see what you chose to carry today."
                  : completedTasks.length > 0
                  ? "You finished what you set out to do. Well done."
                  : "No tasks chosen for today yet. When you're ready, pick what matters from the Mother List."}
              </p>
              <p className="text-xs text-zinc-600 mt-2">
                Affinity: {companion.affinity_score} · Bond XP: {companion.bond_xp || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Focus</h2>
          <Link href="/mother-list" className="text-xs text-violet-400 hover:text-violet-300">
            + Add from Mother List
          </Link>
        </div>

        {incompleteTasks.length > 0 ? (
          <div className="space-y-2">
            {incompleteTasks.map((task: any) => (
              <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <form action={completeTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="title" value={task.title} />
                    <input type="hidden" name="domain" value={task.domain || ''} />
                    <button
                      type="submit"
                      className="mt-0.5 w-6 h-6 rounded-full border-2 border-zinc-600 hover:border-violet-500 hover:bg-violet-600/20 transition flex items-center justify-center"
                      title="Mark complete"
                    />
                  </form>
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
                      {task.recurrence && task.recurrence !== 'none' && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                          {task.recurrence}
                        </span>
                      )}
                      {(task.streak_count || 0) >= 2 && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300">
                          {task.streak_count} day streak
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">
              {completedTasks.length > 0 ? 'All tasks completed for today.' : 'No tasks for today yet.'}
            </p>
            {completedTasks.length === 0 && (
              <Link href="/mother-list" className="inline-block mt-3 text-sm text-violet-400 hover:text-violet-300">
                Choose from Mother List →
              </Link>
            )}
          </div>
        )}
      </div>

      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Completed</h2>
          <div className="space-y-2 opacity-60">
            {completedTasks.map((task: any) => (
              <div
                key={task.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-3"
              >
                <div className="mt-0.5 w-6 h-6 rounded-full bg-violet-600 border-2 border-violet-600 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium line-through text-zinc-500">{task.title}</p>
                  {(task.streak_count || 0) >= 2 && (
                    <p className="text-[10px] text-amber-500/80 mt-1">{task.streak_count} day streak</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
