import { createClient } from '@/utils/supabase/server'
import { getCompanionDef } from '@/lib/companions'
import { pushIfStillUnread } from '@/lib/reads'

const TIMEZONE = 'America/Chicago'
const DAILY_PUSH_CAP = 4
const QUIET_HOUR_START = 22
const QUIET_HOUR_END = 7
const PRODUCTIVE_THRESHOLD = 4
const TASK_REACTION_CHANCE = 0.32
const WANDERING_CHANCE = 0.1
const ANCHOR_PING_MIN = 5
const ANCHOR_PING_MAX = 25

export type OutreachKind =
  | 'task_reaction'
  | 'quiet_day'
  | 'productive_day'
  | 'wandering'
  | 'time_anchor'

function localHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  )
}

function localYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function localMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10)
  return h * 60 + m
}

function parseAnchorMinutes(anchor: string): number | null {
  const m = anchor.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function isQuietHours(): boolean {
  const h = localHour()
  return h >= QUIET_HOUR_START || h < QUIET_HOUR_END
}

function dayStartISO(): string {
  const ymd = localYmd()
  const probe = new Date(`${ymd}T12:00:00Z`)
  const hourInTz = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(probe),
    10
  )
  const offsetHours = 12 - hourInTz
  const midnight = new Date(`${ymd}T00:00:00Z`)
  midnight.setUTCHours(midnight.getUTCHours() + offsetHours)
  return midnight.toISOString()
}

/** Daily cap only counts non-anchor pushes. Time anchors are unlimited vs the cap. */
async function pushesSentToday(): Promise<number> {
  const supabase = await createClient()
  try {
    const { count } = await supabase
      .from('push_log')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', dayStartISO())
      .neq('kind', 'time_anchor')
    return count || 0
  } catch {
    return 0
  }
}

async function logPush(kind: string, companionSlug: string) {
  const supabase = await createClient()
  try {
    await supabase.from('push_log').insert({
      kind,
      companion_slug: companionSlug,
      sent_at: new Date().toISOString(),
    })
  } catch (e) {
    console.error('push_log insert', e)
  }
}

export async function maybeScheduleTaskReaction(opts: {
  taskTitle: string
  companionSlug: string
  domains?: string
}): Promise<boolean> {
  if (Math.random() > TASK_REACTION_CHANCE) return false

  const delayMs = (1 + Math.random() * 3) * 60 * 60 * 1000
  const sendAfter = new Date(Date.now() + delayMs).toISOString()

  const supabase = await createClient()
  try {
    await supabase.from('scheduled_outreach').insert({
      kind: 'task_reaction',
      companion_slug: opts.companionSlug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: {
        taskTitle: opts.taskTitle,
        domains: opts.domains || '',
      },
    })
    return true
  } catch (e) {
    console.error('schedule task reaction', e)
    return false
  }
}

async function pickUnlockedSlug(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companion')
    .select('slug, name, is_unlocked, affinity_score')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const party = (data || []).filter((c) => c.is_unlocked !== false)
  if (party.length === 0) return 'seraphine'

  const weighted = party.flatMap((c) => {
    const slug = c.slug || (c.name === 'Seraphine' ? 'seraphine' : 'seraphine')
    const w = Math.max(1, Math.min(5, Math.floor((c.affinity_score || 1) / 4) + 1))
    return Array(w).fill(slug)
  })
  return weighted[Math.floor(Math.random() * weighted.length)] || 'seraphine'
}

async function completionsToday(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('is_completed', true)
    .gte('completed_at', dayStartISO())
  return count || 0
}

export async function maybeScheduleWanderingCheckIn(): Promise<boolean> {
  if (isQuietHours()) return false
  if (Math.random() > WANDERING_CHANCE) return false

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('scheduled_outreach')
    .select('id')
    .eq('kind', 'wandering')
    .gte('created_at', dayStartISO())
    .limit(1)

  if (existing && existing.length > 0) return false

  const slug = await pickUnlockedSlug()
  const sendAfter = new Date(
    Date.now() + (5 + Math.random() * 35) * 60 * 1000
  ).toISOString()

  try {
    await supabase.from('scheduled_outreach').insert({
      kind: 'wandering',
      companion_slug: slug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: { day: localYmd(), reason: 'just_because' },
    })
    return true
  } catch (e) {
    console.error('schedule wandering', e)
    return false
  }
}

/**
 * Time-anchored pings: no daily-cap cost, not blocked by quiet hours,
 * still one per task per calendar day so cron doesn't spam the window.
 */
export async function maybeScheduleTimeAnchors(): Promise<number> {
  const supabase = await createClient()
  const nowMin = localMinutesNow()
  const ymd = localYmd()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, anchor_time, is_today, is_completed, recurrence')
    .not('anchor_time', 'is', null)
    .eq('is_completed', false)

  if (!tasks?.length) return 0

  const { data: already } = await supabase
    .from('scheduled_outreach')
    .select('payload')
    .eq('kind', 'time_anchor')
    .gte('created_at', dayStartISO())

  const doneTaskIds = new Set<string>()
  for (const row of already || []) {
    const id = (row.payload as { taskId?: string } | null)?.taskId
    if (id) doneTaskIds.add(id)
  }

  let scheduled = 0

  for (const task of tasks) {
    if (!task.anchor_time || doneTaskIds.has(task.id)) continue
    const eligible =
      task.is_today === true || task.recurrence === 'daily' || task.recurrence === 'weekly'
    if (!eligible) continue

    const anchorMin = parseAnchorMinutes(String(task.anchor_time))
    if (anchorMin == null) continue

    const delta = nowMin - anchorMin
    if (delta < ANCHOR_PING_MIN || delta > ANCHOR_PING_MAX) continue

    const slug = await pickUnlockedSlug()
    const sendAfter = new Date(
      Date.now() + (1 + Math.random() * 7) * 60 * 1000
    ).toISOString()

    try {
      await supabase.from('scheduled_outreach').insert({
        kind: 'time_anchor',
        companion_slug: slug,
        send_after: sendAfter,
        bypass_cap: true, // never blocked by daily cap or quiet hours
        payload: {
          taskId: task.id,
          taskTitle: task.title,
          anchor: task.anchor_time,
          day: ymd,
        },
      })
      scheduled++
      doneTaskIds.add(task.id)
    } catch (e) {
      console.error('schedule time anchor', e)
    }
  }

  return scheduled
}

export async function maybeScheduleDayMoments(): Promise<void> {
  const hour = localHour()
  if (hour < 17 || hour >= 22) return

  const supabase = await createClient()
  const ymd = localYmd()

  const { data: existing } = await supabase
    .from('scheduled_outreach')
    .select('kind, payload')
    .in('kind', ['quiet_day', 'productive_day'])
    .gte('created_at', dayStartISO())

  const kinds = new Set((existing || []).map((r) => r.kind))
  const count = await completionsToday()
  const slug = await pickUnlockedSlug()

  if (count >= PRODUCTIVE_THRESHOLD && !kinds.has('productive_day')) {
    const sendAfter = new Date(
      Date.now() + (15 + Math.random() * 30) * 60 * 1000
    ).toISOString()
    await supabase.from('scheduled_outreach').insert({
      kind: 'productive_day',
      companion_slug: slug,
      send_after: sendAfter,
      bypass_cap: true,
      payload: { completions: count, day: ymd },
    })
  } else if (count === 0 && !kinds.has('quiet_day')) {
    const sendAfter = new Date(
      Date.now() + (20 + Math.random() * 40) * 60 * 1000
    ).toISOString()
    await supabase.from('scheduled_outreach').insert({
      kind: 'quiet_day',
      companion_slug: slug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: { day: ymd },
    })
  }
}

function seedForKind(
  kind: OutreachKind,
  name: string,
  payload: Record<string, unknown>
): string {
  if (kind === 'task_reaction') {
    const title = String(payload.taskTitle || 'something')
    return `hey — you finished "${title}" a while ago. text him about it like a real person who noticed, not a coach.`
  }
  if (kind === 'productive_day') {
    return `he got a lot done today. text him. short. in character. no corporate pride speech.`
  }
  if (kind === 'wandering') {
    return `you just wanted to reach him. no reason. text him something real and small.`
  }
  if (kind === 'time_anchor') {
    const title = String(payload.taskTitle || 'that thing he set for this hour')
    return `it's around the time he meant to deal with "${title}". check in like a person — not a reminder app. no "don't forget". just presence.`
  }
  return `day was quiet on his side. check on him without guilt-tripping. be ${name}.`
}

export async function flushDueOutreach(): Promise<{ flushed: number; pushed: number }> {
  const supabase = await createClient()
  const now = new Date().toISOString()

  let rows: {
    id: string
    kind: OutreachKind
    companion_slug: string
    bypass_cap: boolean
    payload: Record<string, unknown>
  }[] = []

  try {
    const { data } = await supabase
      .from('scheduled_outreach')
      .select('id, kind, companion_slug, bypass_cap, payload')
      .is('sent_at', null)
      .lte('send_after', now)
      .order('send_after', { ascending: true })
      .limit(8)
    rows = (data || []) as typeof rows
  } catch (e) {
    console.error('fetch scheduled_outreach', e)
    return { flushed: 0, pushed: 0 }
  }

  let flushed = 0
  let pushed = 0
  const sentToday = await pushesSentToday()

  const { generateCompanionResponse } = await import('@/app/actions')

  for (const row of rows) {
    const def = getCompanionDef(row.companion_slug)
    const name = def?.name || 'Companion'
    const emoji = def?.emoji || '✦'
    const payload = (row.payload || {}) as Record<string, unknown>
    const seed = seedForKind(row.kind, name, payload)

    try {
      const message = await generateCompanionResponse(seed, row.kind, {
        force: true,
        isConversation: true,
        companionSlug: row.companion_slug,
      })

      const preview =
        typeof message === 'string' && message.trim()
          ? message.trim().slice(0, 120)
          : 'She reached out.'

      const messageCreatedAt = new Date().toISOString()

      await supabase
        .from('scheduled_outreach')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', row.id)

      flushed++

      const isTimeAnchor = row.kind === 'time_anchor'
      const underCap = sentToday + pushed < DAILY_PUSH_CAP
      // Time anchors: always allowed (no cap, no quiet-hour block)
      const allowPush =
        isTimeAnchor || row.bypass_cap || (underCap && !isQuietHours())

      if (allowPush) {
        const result = await pushIfStillUnread({
          companionSlug: row.companion_slug,
          messageCreatedAt,
          title: `${emoji} ${name}`,
          body: preview,
          tag: `outreach-${row.kind}-${row.companion_slug}`,
        })
        if (result.pushed) {
          // Only non-anchor pushes inflate the "pushed" counter used for cap this run
          if (!isTimeAnchor) pushed++
          await logPush(row.kind, row.companion_slug)
        }
      }
    } catch (e) {
      console.error('outreach generate', row.id, e)
    }
  }

  return { flushed, pushed }
}
