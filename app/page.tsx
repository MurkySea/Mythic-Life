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
import { Plate, TileIcon } from '@/components/FantasyFrame'
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
      <main className="max-w-md mx-auto p-6">
        <h1 className="ml-title pt-8">Configuration needed</h1>
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
    { href: '/tasks', label: 'Quests', sub: 'Task log', emoji: '📜' },
    { href: '/skills', label: 'Skills', sub: 'Growth', emoji: '⚔️' },
    { href: '/companions', label: 'Party', sub: 'Allies', emoji: '🦊' },
    { href: '/messages', label: 'Letters', sub: 'Messages', emoji: '✉️' },
    { href: '/companion-profile', label: 'Mirror', sub: 'Profile', emoji: '🪞' },
    { href: '/settings', label: 'Codex', sub: 'Settings', emoji: '📖' },
    { href: '/standing', label: 'Standing', sub: rhythm ? tier.label : 'Status', emoji: '⚖️' },
    { href: '#', label: 'Map', sub: 'Soon', emoji: '🗺️', disabled: true },
    { href: '#', label: 'Goals', sub: 'Soon', emoji: '🎯', disabled: true },
  ]

  return (
    <main className="max-w-md mx-auto px-4 pt-5 space-y-5 safe-bottom">
      {/* Character plate */}
      <Plate gold className="px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1">
            <p className="ml-kicker">Mythic Life</p>
            <h1 className="ml-title mt-1.5">Mark Zito</h1>
            <p className="mt-2 text-[12px] font-medium" style={{ color: 'var(--ink-muted)' }}>
              The Unconventional Advisor
            </p>
            <div
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide"
              style={{
                color: 'var(--gold)',
                background: 'rgba(212,168,83,0.1)',
                border: '1px solid rgba(212,168,83,0.28)',
              }}
            >
              Knight of Purpose
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {bestStreak > 0 && (
              <div className="orb orb-gold">
                <span className="text-[7px] font-bold tracking-wider uppercase opacity-70">Streak</span>
                <span className="text-sm font-bold font-display">{bestStreak}</span>
              </div>
            )}
            <div className="orb orb-violet">
              <span className="text-[7px] font-bold tracking-wider uppercase opacity-70">Today</span>
              <span className="text-sm font-bold font-display tabular-nums">
                {doneToday}/{totalToday || '—'}
              </span>
            </div>
          </div>
        </div>
      </Plate>

      {feedback && <FeedbackBanners feedback={feedback} />}

      {/* Active quest */}
      {nextTask && (
        <Plate className="px-5 py-4">
          <div
            className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
            style={{ background: 'linear-gradient(180deg, var(--violet), transparent)' }}
          />
          <div className="flex items-center justify-between gap-3 pl-2">
            <div className="min-w-0">
              <p className="ml-kicker" style={{ color: 'var(--violet)' }}>
                Active quest
              </p>
              <p className="font-display text-[17px] font-semibold mt-1.5 truncate" style={{ color: 'var(--ink)' }}>
                {nextTask.title}
              </p>
            </div>
            {nextTime && (
              <span
                className="shrink-0 text-xs font-bold tabular-nums px-3 py-1.5 rounded-full"
                style={{
                  color: 'var(--sky)',
                  border: '1px solid rgba(125,211,252,0.35)',
                  background: 'rgba(14,30,48,0.75)',
                }}
              >
                {nextTime}
              </span>
            )}
          </div>
        </Plate>
      )}

      {/* Quest log */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="ml-kicker" style={{ color: 'var(--ink-dim)' }}>
            Today's quests
          </h2>
          <Link href="/mother-list" className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
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
                  <div
                    key={task.id}
                    className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl"
                    style={{
                      background: 'linear-gradient(180deg, #1a1630 0%, #12101c 100%)',
                      border: '1px solid rgba(70,58,110,0.55)',
                      boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
                    }}
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
                        <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                          {task.title}
                        </p>
                        {timeLabel && (
                          <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--sky)' }}>
                            {timeLabel}
                          </span>
                        )}
                      </div>
                      {(task.streak_count || 0) >= 2 && (
                        <p className="text-[10px] font-semibold mt-1" style={{ color: 'var(--gold)' }}>
                          {task.streak_count} day streak
                        </p>
                      )}
                    </div>
                  </div>
                )
              }
            )}
          </div>
        ) : (
          <div
            className="px-5 py-9 text-center rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, #1a1630 0%, #12101c 100%)',
              border: '1px dashed rgba(90,75,130,0.45)',
            }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>
              {completedTasks.length > 0 ? 'All quests complete for today.' : 'No quests on the board.'}
            </p>
            {completedTasks.length === 0 && (
              <Link href="/mother-list" className="inline-block mt-3 text-sm font-semibold" style={{ color: 'var(--gold)' }}>
                Draw from the Mother List →
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Standing */}
      <Link href="/standing" className="block">
        <Plate gold className="px-5 py-4">
          <div
            className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
            style={{ background: 'linear-gradient(180deg, var(--gold), transparent)' }}
          />
          <div className="flex items-center justify-between pl-2">
            <div className="min-w-0">
              <p className="ml-kicker">Standing</p>
              {rhythm ? (
                <div className="mt-1.5">
                  <p className={`font-display text-[15px] font-semibold ${tier.color}`}>
                    Rhythm · {tier.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-dim)' }}>
                    {standing?.sleep?.bedtimeDisplay && standing?.sleep?.wakeDisplay
                      ? `${standing.sleep.bedtimeDisplay} → ${standing.sleep.wakeDisplay}`
                      : 'Sleep window scored'}
                  </p>
                </div>
              ) : (
                <p className="text-sm font-medium mt-1.5" style={{ color: 'var(--ink-muted)' }}>
                  Self · Consistency · Shadow Debt
                </p>
              )}
            </div>
            <span className="text-2xl opacity-80">⚖️</span>
          </div>
        </Plate>
      </Link>

      {/* Grimoire */}
      <section>
        <p className="ml-kicker mb-3 px-1" style={{ color: 'var(--ink-dim)' }}>
          Grimoire
        </p>
        <div className="grid grid-cols-3 gap-3">
          {modules.map((m) =>
            (m as { disabled?: boolean }).disabled ? (
              <div
                key={m.label}
                className="rounded-2xl p-3.5 opacity-30 flex flex-col items-center"
                style={{ border: '1px solid #2a2440', background: '#0e0c16' }}
              >
                <TileIcon emoji={m.emoji} label={m.label} />
                <span className="text-[9px] mt-1" style={{ color: 'var(--ink-dim)' }}>
                  {m.sub}
                </span>
              </div>
            ) : (
              <Link
                key={m.label}
                href={m.href}
                className="grimoire-tile p-3.5 flex flex-col items-center gap-0.5"
              >
                <TileIcon emoji={m.emoji} label={m.label} />
                <span className="text-[9px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>
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
