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
import { fetchLatestStanding, tierStyle } from '@/lib/standing'

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
    <main className="max-w-md mx-auto p-4 space-y-5 pb-10">
      {/* ── Identity + status ── */}
      <div className="pt-3 flex items-end justify-between">
        <div>
          <p className="text-zinc-500 text-xs tracking-wide">The Unconventional Advisor</p>
          <h1 className="text-xl font-medium text-white leading-tight">Mark Zito</h1>
        </div>
        <div className="flex items-center gap-3 text-right">
          {bestStreak > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Streak</p>
              <p className="text-base font-medium text-amber-400">{bestStreak}🔥</p>
            </div>
          )}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Today</p>
            <p className="text-base font-medium text-violet-300">
              {doneToday}/{totalToday || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Feedback (gains / unlocks) ── */}
      {feedback && (
        <div className="space-y-2">
          {(feedback.unlocked || []).map((u) => (
            <div
              key={u.slug}
              className="rounded-2xl border border-amber-600/40 bg-amber-950/30 p-3"
            >
              <p className="text-amber-200 text-sm font-medium">
                {u.emoji} {u.name} joined your party
              </p>
              <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{u.line}</p>
              <Link
                href={`/messages?c=${u.slug}`}
                className="inline-block mt-1.5 text-xs text-amber-300/90 hover:text-amber-200"
              >
                Speak with them →
              </Link>
            </div>
          ))}
          <div className="rounded-2xl border border-violet-700/40 bg-violet-950/30 p-3">
            <p className="text-[11px] uppercase tracking-wider text-violet-400/80 mb-1.5">Gains</p>
            <div className="flex flex-wrap gap-1.5">
              {(feedback.skillGains || []).map((g) => (
                <span
                  key={g.skill}
                  className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-violet-200 border border-violet-800/40"
                >
                  +{g.xp} {g.label} · Lv {g.level}
                </span>
              ))}
              {feedback.bondXp > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-fuchsia-200 border border-fuchsia-800/40">
                  +{feedback.bondXp} bond · {feedback.companionName}
                </span>
              )}
              {(feedback.streak || 0) >= 2 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-amber-200 border border-amber-800/40">
                  {feedback.streak} day streak
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Compact Today's Focus ── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Today's Focus
          </h2>
          <Link href="/mother-list" className="text-xs text-violet-400 hover:text-violet-300">
            + Mother List
          </Link>
        </div>

        {incompleteTasks.length > 0 ? (
          <div className="space-y-1.5">
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
                    className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2.5 flex items-center gap-3"
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
                        <p className="text-sm font-medium text-white truncate">{task.title}</p>
                        {timeLabel && (
                          <span className="shrink-0 text-[11px] font-medium text-sky-300 tabular-nums">
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
                className="block text-center text-xs text-violet-400 py-1 hover:text-violet-300"
              >
                +{incompleteTasks.length - 4} more →
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-xl px-4 py-5 text-center">
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

      {/* ── Standing teaser → full page ── */}
      <Link
        href="/standing"
        className="block rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-violet-700/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Standing</p>
            {rhythm ? (
              <div className="mt-1 space-y-0.5">
                <p className={`text-sm font-medium ${tier.color}`}>
                  Rhythm · {tier.label}
                  {rhythm.rewardEfficiency !== 1 && (
                    <span className="text-zinc-400 font-normal">
                      {' '}· {rhythm.rewardEfficiency.toFixed(2)}× rewards
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {standing?.sleep?.bedtimeDisplay && standing?.sleep?.wakeDisplay
                    ? `${standing.sleep.bedtimeDisplay} → ${standing.sleep.wakeDisplay}`
                    : 'Sleep window scored'}
                  {rhythm.shadowDebtDelta !== 0 && (
                    <span>
                      {' '}· Debt {rhythm.shadowDebtDelta > 0 ? '+' : ''}
                      {rhythm.shadowDebtDelta}
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 mt-0.5">
                Self · Consistency · Debt — waiting for health data
              </p>
            )}
          </div>
          <span className="text-zinc-500 text-lg shrink-0">›</span>
        </div>
      </Link>

      {/* ── Module grid ── */}
      <section>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2.5">World</p>
        <div className="grid grid-cols-3 gap-2.5">
          {modules.map((m) =>
            (m as { disabled?: boolean }).disabled ? (
              <div
                key={m.label}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 flex flex-col items-start gap-1 opacity-50"
              >
                <span className="text-xl leading-none">{m.icon}</span>
                <span className="text-sm font-medium text-zinc-400">{m.label}</span>
                <span className="text-[10px] text-zinc-600">{m.sub}</span>
              </div>
            ) : (
              <Link
                key={m.label}
                href={m.href}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 flex flex-col items-start gap-1 hover:border-violet-600/50 hover:bg-zinc-900 transition-colors"
              >
                <span className="text-xl leading-none">{m.icon}</span>
                <span className="text-sm font-medium text-white">{m.label}</span>
                <span className="text-[10px] text-zinc-500">{m.sub}</span>
              </Link>
            )
          )}
        </div>
      </section>
    </main>
  )
}
