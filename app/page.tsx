import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
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
import { maybeCompanionCheckIn } from './check-in-actions'
import { maybeScheduleTaskReaction } from '@/lib/outreach'
import { parseDomains, SKILL_LABELS, type SkillKey } from '@/lib/skills'
import { getCompanionDef } from '@/lib/companions'
import { setFeedback, readFeedback } from '@/lib/feedback'
import { PendingCircleButton } from '@/components/PendingSubmit'
import FeedbackBanners from '@/components/FeedbackBanners'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'
import { runStandingForCompletedTask } from '@/lib/engines/apply-task'

export const dynamic = 'force-dynamic'

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

function anchorMinutes(time: string | null | undefined): number {
  if (!time) return 9999
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return 9999
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

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
  const unlockedDetails = await postUnlockCeremony(newlyUnlocked)

  await runStandingForCompletedTask({ title, domains })

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
  revalidatePath('/standing')
  revalidatePath('/skills')
  revalidatePath('/companions')
  revalidatePath('/companion-profile')

  after(async () => {
    try {
      await generateCompanionResponse(title, domains.join(', '), {
        streak,
        companionSlug: slug,
      })
      await maybeScheduleTaskReaction({
        taskTitle: title,
        companionSlug: slug,
        domains: domains.join(','),
      })
      revalidatePath('/messages')
      revalidatePath('/')
    } catch (e) {
      console.error('background companion reply failed', e)
    }
  })
}

export default async function HubPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-xl font-medium text-white pt-8">Configuration needed</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Supabase environment variables are missing on this deployment.
        </p>
      </main>
    )
  }

  await ensureRecurringTasks()

  after(async () => {
    try {
      await maybeCompanionCheckIn()
      revalidatePath('/messages')
    } catch (e) {
      console.error('check-in failed', e)
    }
  })

  const feedback = await readFeedback()
  const standing = await fetchLatestStanding()
  const supabase = await createClient()

  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_today', true)
    .order('created_at', { ascending: true })

  const incompleteTasks = (todayTasks?.filter((t) => !t.is_completed) || []).slice().sort((a, b) => {
    const ta = anchorMinutes(a.anchor_time)
    const tb = anchorMinutes(b.anchor_time)
    if (ta !== tb) return ta - tb
    return 0
  })
  const completedTasks = todayTasks?.filter((t) => t.is_completed) || []
  const totalToday = (todayTasks || []).length
  const doneToday = completedTasks.length
  const bestStreak = Math.max(
    0,
    ...(todayTasks || []).map((t: { streak_count?: number }) => t.streak_count || 0)
  )

  const rhythm = standing?.rhythm
  const tier = tierStyle(rhythm?.tier)

  const nextTask = incompleteTasks[0] || null
  const nextTime = nextTask ? formatAnchor(nextTask.anchor_time) : null

  const modules = [
    { href: '/tasks', label: 'Tasks', sub: 'Full list', icon: '📜' },
    { href: '/skills', label: 'Skills', sub: 'Level up', icon: '💪' },
    { href: '/companions', label: 'Companions', sub: 'Party', icon: '🦊' },
    { href: '/messages', label: 'Messages', sub: 'Chat', icon: '💬' },
    { href: '/companion-profile', label: 'Profile', sub: 'You & them', icon: '🪞' },
    { href: '/settings', label: 'Settings', sub: 'More', icon: '⚙️' },
    {
      href: '/standing',
      label: 'Standing',
      sub: rhythm ? tier.label : 'Rhythm',
      icon: '📊',
    },
    { href: '#', label: 'Map', sub: 'Soon', icon: '🗺️', disabled: true },
    { href: '#', label: 'Goals', sub: 'Soon', icon: '🎯', disabled: true },
  ]

  return (
    <main className="max-w-md mx-auto px-4 pt-5 space-y-5 safe-bottom">
      {/* Identity */}
      <div className="flex items-end justify-between pt-1">
        <div>
          <p className="text-[11px] tracking-[0.06em] text-zinc-500 uppercase">
            The Unconventional Advisor
          </p>
          <h1 className="text-[22px] font-semibold text-white tracking-tight mt-0.5">Mark Zito</h1>
        </div>
        <div className="flex items-center gap-4 text-right">
          {bestStreak > 0 && (
            <div>
              <p className="section-label">Streak</p>
              <p className="text-[15px] font-semibold text-amber-400 mt-0.5">{bestStreak}🔥</p>
            </div>
          )}
          <div>
            <p className="section-label">Today</p>
            <p className="text-[15px] font-semibold text-violet-300 mt-0.5 tabular-nums">
              {doneToday}/{totalToday || '—'}
            </p>
          </div>
        </div>
      </div>

      {feedback && <FeedbackBanners feedback={feedback} />}

      {/* What's Next */}
      {nextTask && (
        <section className="rounded-2xl border border-violet-700/30 bg-gradient-to-br from-violet-950/35 to-zinc-900/40 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] text-violet-400/90">What's next</p>
              <p className="text-[15px] font-medium text-white truncate mt-1">{nextTask.title}</p>
            </div>
            {nextTime && (
              <span className="shrink-0 text-xs font-semibold text-sky-300/90 tabular-nums bg-sky-950/40 border border-sky-800/30 rounded-full px-2.5 py-1">
                {nextTime}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Today's Focus */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="section-label">Today's Focus</h2>
          <Link href="/mother-list" className="text-xs text-violet-400/90 hover:text-violet-300">
            + Mother List
          </Link>
        </div>

        {incompleteTasks.length > 0 ? (
          <div className="space-y-2">
            {incompleteTasks.slice(0, 4).map(
              (task: {
                id: string
                title: string
                domains?: string
                domain?: string
                streak_count?: number
                anchor_time?: string
              }) => {
                const domains = parseDomains(task.domains, task.domain)
                const timeLabel = formatAnchor(task.anchor_time)
                return (
                  <div
                    key={task.id}
                    className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl px-3.5 py-3 flex items-center gap-3 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]"
                  >
                    <form action={completeTask} className="shrink-0">
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="title" value={task.title} />
                      <input type="hidden" name="domains" value={domains.join(',')} />
                      <input type="hidden" name="domain" value={task.domain || ''} />
                      <PendingCircleButton />
                    </form>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-medium text-white truncate">{task.title}</p>
                        {timeLabel && (
                          <span className="shrink-0 text-[11px] font-medium text-sky-300/90 tabular-nums">
                            {timeLabel}
                          </span>
                        )}
                      </div>
                      {(task.streak_count || 0) >= 2 && (
                        <p className="text-[10px] text-amber-400/90 mt-0.5">
                          {task.streak_count} day streak
                        </p>
                      )}
                    </div>
                  </div>
                )
              }
            )}
            {incompleteTasks.length > 4 && (
              <Link
                href="/tasks"
                className="block text-center text-xs text-violet-400/90 py-1 hover:text-violet-300"
              >
                +{incompleteTasks.length - 4} more →
              </Link>
            )}
          </div>
        ) : (
          <div className="border border-dashed border-zinc-800 rounded-2xl px-4 py-6 text-center bg-zinc-900/30">
            <p className="text-zinc-500 text-sm">
              {completedTasks.length > 0 ? 'All clear for today.' : 'No tasks yet.'}
            </p>
            {completedTasks.length === 0 && (
              <Link href="/mother-list" className="inline-block mt-2 text-sm text-violet-400">
                Choose from Mother List →
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Standing teaser */}
      <Link
        href="/standing"
        className="block rounded-2xl border border-zinc-800/90 bg-zinc-900/50 px-4 py-3.5 hover:border-violet-700/40 transition-colors shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="section-label">Standing</p>
            {rhythm ? (
              <div className="mt-1 space-y-0.5">
                <p className={`text-[15px] font-medium ${tier.color}`}>
                  Rhythm · {tier.label}
                  {rhythm.rewardEfficiency !== 1 && (
                    <span className="text-zinc-500 font-normal">
                      {' '}· {rhythm.rewardEfficiency.toFixed(2)}×
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {standing?.sleep?.bedtimeDisplay && standing?.sleep?.wakeDisplay
                    ? `${standing.sleep.bedtimeDisplay} → ${standing.sleep.wakeDisplay}`
                    : 'Sleep window scored'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 mt-1">Self · Consistency · Debt</p>
            )}
          </div>
          <span className="text-zinc-600 text-lg shrink-0">›</span>
        </div>
      </Link>

      {/* World grid */}
      <section>
        <p className="section-label mb-2.5 px-0.5">World</p>
        <div className="grid grid-cols-3 gap-2.5">
          {modules.map((m) =>
            (m as { disabled?: boolean }).disabled ? (
              <div
                key={m.label}
                className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-3.5 flex flex-col items-start gap-1.5 opacity-40"
              >
                <span className="text-[22px] leading-none">{m.icon}</span>
                <span className="text-[13px] font-medium text-zinc-400">{m.label}</span>
                <span className="text-[10px] text-zinc-600">{m.sub}</span>
              </div>
            ) : (
              <Link key={m.label} href={m.href} className="module-tile p-3.5 flex flex-col items-start gap-1.5">
                <span className="text-[22px] leading-none">{m.icon}</span>
                <span className="text-[13px] font-medium text-white">{m.label}</span>
                <span className="text-[10px] text-zinc-500">{m.sub}</span>
              </Link>
            )
          )}
        </div>
      </section>
    </main>
  )
}
