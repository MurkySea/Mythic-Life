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
        <h1 className="ml-title pt-8">Configuration needed</h1>
        <p className="text-zinc-400 text-sm">Supabase environment variables are missing.</p>
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
    <main className="max-w-md mx-auto px-4 pt-5 space-y-6 safe-bottom">
      {/* Hero identity */}
      <header className="ml-panel px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ml-kicker text-[var(--violet)]" style={{ color: '#9b7dff' }}>
              Mythic Life
            </p>
            <h1 className="ml-title mt-1">Mark Zito</h1>
            <p className="ml-meta mt-1.5">The Unconventional Advisor</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            {bestStreak > 0 && (
              <div className="ml-chip ml-chip-amber">
                <span className="text-[8px] font-bold tracking-[0.12em] uppercase opacity-80">Streak</span>
                <span className="text-sm font-bold mt-0.5">{bestStreak}🔥</span>
              </div>
            )}
            <div className="ml-chip ml-chip-violet">
              <span className="text-[8px] font-bold tracking-[0.12em] uppercase opacity-80">Today</span>
              <span className="text-sm font-bold mt-0.5 tabular-nums">
                {doneToday}/{totalToday || '—'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {feedback && <FeedbackBanners feedback={feedback} />}

      {/* What's Next */}
      {nextTask && (
        <section className="ml-panel ml-rail-violet px-5 py-4">
          <div className="flex items-center justify-between gap-3 pl-1.5">
            <div className="min-w-0">
              <p className="ml-kicker" style={{ color: '#9b7dff' }}>
                What's next
              </p>
              <p className="text-[17px] font-bold text-white truncate mt-1.5 tracking-tight">
                {nextTask.title}
              </p>
            </div>
            {nextTime && (
              <span className="ml-chip ml-chip-sky shrink-0 !flex-row !min-w-0 gap-0 px-3 py-1.5 text-xs font-bold tabular-nums">
                {nextTime}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Today's Focus */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="ml-kicker">Today's Focus</h2>
          <Link
            href="/mother-list"
            className="text-xs font-semibold hover:opacity-80"
            style={{ color: '#9b7dff' }}
          >
            + Mother List
          </Link>
        </div>

        {incompleteTasks.length > 0 ? (
          <div className="space-y-2.5">
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
                  <div key={task.id} className="ml-panel-flat px-4 py-3.5 flex items-center gap-3.5">
                    <form action={completeTask} className="shrink-0">
                      <input type="hidden" name="id" value={task.id} />
                      <input type="hidden" name="title" value={task.title} />
                      <input type="hidden" name="domains" value={domains.join(',')} />
                      <input type="hidden" name="domain" value={task.domain || ''} />
                      <PendingCircleButton />
                    </form>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-semibold text-white truncate tracking-tight">
                          {task.title}
                        </p>
                        {timeLabel && (
                          <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color: '#5eb8ff' }}>
                            {timeLabel}
                          </span>
                        )}
                      </div>
                      {(task.streak_count || 0) >= 2 && (
                        <p className="text-[10px] font-semibold mt-1" style={{ color: '#f0b429' }}>
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
                className="block text-center text-xs font-semibold py-1.5 hover:opacity-80"
                style={{ color: '#9b7dff' }}
              >
                +{incompleteTasks.length - 4} more →
              </Link>
            )}
          </div>
        ) : (
          <div className="ml-panel-flat px-5 py-8 text-center">
            <p className="text-sm font-medium" style={{ color: '#8b8b9a' }}>
              {completedTasks.length > 0 ? 'All clear for today.' : 'No tasks yet.'}
            </p>
            {completedTasks.length === 0 && (
              <Link
                href="/mother-list"
                className="inline-block mt-3 text-sm font-semibold"
                style={{ color: '#9b7dff' }}
              >
                Choose from Mother List →
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Standing */}
      <Link href="/standing" className="block ml-panel ml-rail-amber px-5 py-4 transition-opacity hover:opacity-95">
        <div className="flex items-center justify-between pl-1.5">
          <div className="min-w-0">
            <p className="ml-kicker" style={{ color: '#f0b429' }}>
              Standing
            </p>
            {rhythm ? (
              <div className="mt-1.5 space-y-0.5">
                <p className={`text-[15px] font-bold tracking-tight ${tier.color}`}>
                  Rhythm · {tier.label}
                  {rhythm.rewardEfficiency !== 1 && (
                    <span className="font-medium" style={{ color: '#8b8b9a' }}>
                      {' '}· {rhythm.rewardEfficiency.toFixed(2)}×
                    </span>
                  )}
                </p>
                <p className="text-xs font-medium" style={{ color: '#5c5c6b' }}>
                  {standing?.sleep?.bedtimeDisplay && standing?.sleep?.wakeDisplay
                    ? `${standing.sleep.bedtimeDisplay} → ${standing.sleep.wakeDisplay}`
                    : 'Sleep window scored'}
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium mt-1.5" style={{ color: '#8b8b9a' }}>
                Self · Consistency · Debt
              </p>
            )}
          </div>
          <span className="text-2xl font-light shrink-0" style={{ color: '#5c5c6b' }}>
            ›
          </span>
        </div>
      </Link>

      {/* World */}
      <section>
        <p className="ml-kicker mb-3 px-1">World</p>
        <div className="grid grid-cols-3 gap-3">
          {modules.map((m) =>
            (m as { disabled?: boolean }).disabled ? (
              <div
                key={m.label}
                className="rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--bg-elevated)] p-3.5 flex flex-col items-start gap-1.5 opacity-30"
              >
                <span className="text-[26px] leading-none">{m.icon}</span>
                <span className="text-[13px] font-bold" style={{ color: '#8b8b9a' }}>
                  {m.label}
                </span>
                <span className="text-[10px] font-medium" style={{ color: '#5c5c6b' }}>
                  {m.sub}
                </span>
              </div>
            ) : (
              <Link key={m.label} href={m.href} className="ml-tile p-3.5 flex flex-col items-start gap-1.5">
                <span className="text-[26px] leading-none">{m.icon}</span>
                <span className="text-[13px] font-bold text-white">{m.label}</span>
                <span className="text-[10px] font-medium" style={{ color: '#8b8b9a' }}>
                  {m.sub}
                </span>
              </Link>
            )
          )}
        </div>
      </section>
    </main>
  )
}
