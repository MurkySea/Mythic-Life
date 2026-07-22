import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import {
  ensureRecurringTasks,
  awardBondProgress,
  generateCompanionResponse,
  updateTaskStreak,
  awardSkillXp,
  pickReactingCompanion,
  postUnlockCeremony,
} from './actions'
import { parseDomains, SKILL_LABELS, xpIntoLevel, type SkillKey } from '@/lib/skills'
import { getCompanionDef } from '@/lib/companions'
import { setFeedback, readFeedback } from '@/lib/feedback'

export const dynamic = 'force-dynamic'

async function completeTask(formData: FormData) {
  'use server'

  const id = formData.get('id') as string
  const title = formData.get('title') as string
  const domainsStr = (formData.get('domains') as string) || ''
  const domainLegacy = (formData.get('domain') as string) || ''

  const supabase = await createClient()

  await supabase
    .from('tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)

  const domains = parseDomains(domainsStr, domainLegacy)
  const { streak } = await updateTaskStreak(id)
  const { newlyUnlocked, skillGains } = await awardSkillXp(domains)
  const slug = await pickReactingCompanion(domains)
  const bond = await awardBondProgress(domains.join(','), streak, slug)
  await generateCompanionResponse(title, domains.join(', '), { streak, companionSlug: slug })

  const unlockedDetails = await postUnlockCeremony(newlyUnlocked)

  const def = getCompanionDef(slug)
  await setFeedback({
    skillGains: (skillGains || []).map((g) => ({
      skill: g.skill,
      label: SKILL_LABELS[g.skill as SkillKey] || g.skill,
      xp: g.xpAdded,
      level: g.level,
    })),
    bondXp: bond.xpGained || 0,
    companionName: def?.name || 'Companion',
    companionSlug: slug,
    unlocked: unlockedDetails,
    streak,
  })

  revalidatePath('/')
  revalidatePath('/messages')
  revalidatePath('/companions')
  revalidatePath('/skills')
  revalidatePath('/companion-profile')
}

export default async function TodayPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6 pb-24 space-y-4">
        <h1 className="text-xl font-medium text-white pt-8">Configuration needed</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Supabase environment variables are missing on this deployment. In Vercel → Settings →
          Environment Variables, set:
        </p>
        <ul className="text-sm text-violet-300 space-y-1 font-mono">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-zinc-500 text-xs">Then Redeploy Production from the Deployments tab.</p>
      </main>
    )
  }

  await ensureRecurringTasks()

  const feedback = await readFeedback()
  const supabase = await createClient()

  const { data: companions } = await supabase
    .from('companion')
    .select('*')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const { data: skills } = await supabase.from('player_skills').select('*')

  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_today', true)
    .order('created_at', { ascending: true })

  const incompleteTasks = todayTasks?.filter((t) => !t.is_completed) || []
  const completedTasks = todayTasks?.filter((t) => t.is_completed) || []
  const bestStreak = Math.max(0, ...(todayTasks || []).map((t: { streak_count?: number }) => t.streak_count || 0))

  const skillMap: Record<string, number> = {}
  for (const s of skills || []) skillMap[s.skill] = s.xp || 0

  const topSkills = (['faith', 'discipline', 'fitness', 'knowledge'] as SkillKey[]).map((k) => {
    const xp = skillMap[k] || 0
    const { level, into, need } = xpIntoLevel(xp)
    return { key: k, label: SKILL_LABELS[k], level, into, need, xp }
  })

  const unlocked = companions || []

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

      {feedback && (
        <div className="space-y-2">
          {(feedback.unlocked || []).map((u) => (
            <div
              key={u.slug}
              className="rounded-2xl border border-amber-600/40 bg-amber-950/30 p-4"
            >
              <p className="text-amber-200 text-sm font-medium">
                {u.emoji} {u.name} joined your party
              </p>
              <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{u.line}</p>
              <Link
                href={`/messages?c=${u.slug}`}
                className="inline-block mt-2 text-xs text-amber-300/90 hover:text-amber-200"
              >
                Speak with them →
              </Link>
            </div>
          ))}
          <div className="rounded-2xl border border-violet-700/40 bg-violet-950/30 p-4">
            <p className="text-[11px] uppercase tracking-wider text-violet-400/80 mb-2">Gains</p>
            <div className="flex flex-wrap gap-2">
              {(feedback.skillGains || []).map((g) => (
                <span
                  key={g.skill}
                  className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 text-violet-200 border border-violet-800/40"
                >
                  +{g.xp} {g.label} · Lv {g.level}
                </span>
              ))}
              {feedback.bondXp > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 text-fuchsia-200 border border-fuchsia-800/40">
                  +{feedback.bondXp} bond · {feedback.companionName}
                </span>
              )}
              {(feedback.streak || 0) >= 2 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 text-amber-200 border border-amber-800/40">
                  {feedback.streak} day streak
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Skills</p>
          <Link href="/skills" className="text-xs text-violet-400 hover:text-violet-300">
            Full tree →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {topSkills.map((s) => (
            <div key={s.key}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-400">{s.label}</span>
                <span className="text-violet-300">Lv {s.level}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-violet-500/80 rounded-full"
                  style={{ width: `${Math.min(100, (s.into / s.need) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {unlocked.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {unlocked.map((c: { id: string; name: string; slug?: string }) => {
            const slug = c.slug || (c.name === 'Seraphine' ? 'seraphine' : '')
            const def = getCompanionDef(slug)
            return (
              <Link
                key={c.id}
                href={`/messages?c=${slug}`}
                className="shrink-0 flex flex-col items-center gap-1 px-2"
              >
                <div className="w-11 h-11 rounded-full bg-violet-900/40 border border-violet-700/50 flex items-center justify-center text-lg">
                  {def?.emoji || '✦'}
                </div>
                <span className="text-[10px] text-zinc-400 max-w-[56px] truncate">{c.name}</span>
              </Link>
            )
          })}
          <Link href="/companions" className="shrink-0 flex flex-col items-center gap-1 px-2">
            <div className="w-11 h-11 rounded-full border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500 text-sm">
              +
            </div>
            <span className="text-[10px] text-zinc-500">Party</span>
          </Link>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Focus</h2>
          <Link href="/mother-list" className="text-xs text-violet-400 hover:text-violet-300">
            + Mother List
          </Link>
        </div>

        {incompleteTasks.length > 0 ? (
          <div className="space-y-2">
            {incompleteTasks.map(
              (task: {
                id: string
                title: string
                domains?: string
                domain?: string
                recurrence?: string
                streak_count?: number
              }) => {
                const domains = parseDomains(task.domains, task.domain)
                return (
                  <div key={task.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <form action={completeTask}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="title" value={task.title} />
                        <input type="hidden" name="domains" value={domains.join(',')} />
                        <input type="hidden" name="domain" value={task.domain || ''} />
                        <button
                          type="submit"
                          className="mt-0.5 w-6 h-6 rounded-full border-2 border-zinc-600 hover:border-violet-500 hover:bg-violet-600/20 transition"
                          title="Mark complete"
                        />
                      </form>
                      <div className="flex-1">
                        <p className="font-medium text-white">{task.title}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {domains.map((d) => (
                            <span
                              key={d}
                              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                            >
                              {SKILL_LABELS[d] || d}
                            </span>
                          ))}
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
                )
              }
            )}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-zinc-500 text-sm">
              {completedTasks.length > 0 ? 'All tasks completed for today.' : 'No tasks for today yet.'}
            </p>
            {completedTasks.length === 0 && (
              <Link href="/mother-list" className="inline-block mt-3 text-sm text-violet-400">
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
            {completedTasks.map((task: { id: string; title: string }) => (
              <div
                key={task.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-3"
              >
                <div className="mt-0.5 w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <p className="font-medium line-through text-zinc-500">{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
