import { createClient } from '@/utils/supabase/server'
import { getCompanionDef } from '@/lib/companions'
import { sendPushToAll } from '@/lib/push'

const TIMEZONE = 'America/Chicago'
const DAILY_PUSH_CAP = 4
const QUIET_HOUR_START = 22 // 10pm local
const QUIET_HOUR_END = 7 // 7am local
const PRODUCTIVE_THRESHOLD = 4 // completions in a day
const TASK_REACTION_CHANCE = 0.32
/** ~10% per cron tick during daytime; max one wandering check-in per calendar day */
const WANDERING_CHANCE = 0.1

export type OutreachKind =
  | 'task_reaction'
  | 'quiet_day'
  | 'productive_day'
  | 'wandering'

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

/** True during local quiet hours (no routine pushes). */
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

async function pushesSentToday(): Promise<number> {
  const supabase = await createClient()
  try {
    const { count } = await supabase
      .from('push_log')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', dayStartISO())
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

/** Schedule a delayed task reaction (1–4h). Chance-based. */
export async function maybeScheduleTaskReaction(opts: {
  taskTitle: string
  companionSlug: string
  domains?: string
}): Promise<boolean> {
  if (Math.random() > TASK_REACTION_CHANCE) return false

  const delayMs = (1 + Math.random() * 3) * 60 * 60 * 1000 // 1–4 hours
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

/**
 * Pure presence: a companion reaches out for no reason except that they wanted to.
 * Daytime only, ~10% per cron tick, at most once per calendar day.
 */
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
  // Fire soon — 5–40 minutes — so it feels spontaneous, not scheduled
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

/** Evening pass: quiet day or productive day (once each per calendar day). */
export async function maybeScheduleDayMoments(): Promise<void> {
  const hour = localHour()
  // Evening window 5pm–9pm local
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
    const title = String(payload.taskTitle || 'something he set himself to')
    return `${name} noticed Mark finished "${title}" a while ago — not instantly. She reaches out now the way a real person would after the moment has settled. Presence, not a scoreboard.`
  }
  if (kind === 'productive_day') {
    const n = payload.completions || 'several'
    return `${name} noticed Mark carried a heavy, productive day (about ${n} things done). She reaches out in the evening — impressed or teasing in character, never corporate. Celebrate him as a person.`
  }
  if (kind === 'wandering') {
    return `${name} reaches out for no practical reason. Not a task. Not a report. Not because the day was quiet or loud. She simply wanted Mark to feel her presence for a moment — a companion checking on someone she cares about. Brief, in character, emotionally real.`
  }
  return `${name} noticed the day stayed quiet — little motion from Mark. She reaches out with presence, not guilt. Soft check-in from her world to his.`
}

/** Flush due outreach rows: write message + optional push. */
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
          : 'She reached out — open Messages.'

      await supabase
        .from('scheduled_outreach')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', row.id)

      flushed++

      const underCap = sentToday + pushed < DAILY_PUSH_CAP
      const allowPush = row.bypass_cap || (underCap && !isQuietHours())

      if (allowPush) {
        try {
          const result = await sendPushToAll({
            title: `${emoji} ${name}`,
            body: preview,
            url: `/messages?c=${row.companion_slug}`,
            tag: `outreach-${row.kind}-${row.companion_slug}`,
          })
          if (result.sent > 0) {
            pushed++
            await logPush(row.kind, row.companion_slug)
          }
        } catch (e) {
          console.error('outreach push', e)
        }
      }
    } catch (e) {
      console.error('outreach generate', row.id, e)
    }
  }

  return { flushed, pushed }
}
