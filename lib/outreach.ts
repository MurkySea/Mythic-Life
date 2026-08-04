import { createClient } from '@/utils/supabase/server'
import { getCompanionDef } from '@/lib/companions'
import { pushIfStillUnread } from '@/lib/reads'
import { loadPlayerState } from '@/lib/player-state'
import {
  buildUnitReaction,
  partyContextBlurb,
  lifeSignalSeed,
  isFoundingCompanion,
  type PartyMoodInput,
  type LifeSignalKind,
} from '@/lib/engines/party-doctrine'
import { hasMember } from '@/lib/engines/party'
import { loadCompanionKnowledge } from '@/lib/character-engine/knowledge'
import { computeKnowledgeGaps } from '@/lib/character-engine/curiosity'

const TIMEZONE = 'America/Chicago'
const DAILY_PUSH_CAP = 5
const QUIET_HOUR_START = 22
const QUIET_HOUR_END = 7
const PRODUCTIVE_THRESHOLD = 4
const TASK_REACTION_CHANCE = 0.22
const WANDERING_CHANCE = 0.18
const MISSING_YOU_CHANCE = 0.14
const SHARE_MOMENT_CHANCE = 0.12
const PARTY_UNIT_CHANCE = 0.4
const CURIOSITY_INITIATION_BASE = 0.26
const CURIOSITY_SILENCE_HOURS = 12
const ANCHOR_PING_MIN = 5
const ANCHOR_PING_MAX = 25

/** Heavy emotional outreach — at most one of these per companion per day. */
const HEAVY_OUTREACH_KINDS = ['missing_you', 'soft_love', 'curiosity'] as const

export type OutreachKind =
  | 'task_reaction'
  | 'quiet_day'
  | 'productive_day'
  | 'wandering'
  | 'time_anchor'
  | 'missing_you'
  | 'share_moment'
  | 'soft_love'
  | 'party_unit'
  | 'curiosity'

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

/** Prefer active party members; fall back to unlocked roster. */
async function pickUnlockedCompanion(opts?: {
  minAffinity?: number
  preferHighBond?: boolean
  preferParty?: boolean
}): Promise<{ slug: string; affinity: number; name: string } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companion')
    .select('slug, name, is_unlocked, affinity_score')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  let party = (data || []).filter((c) => c.is_unlocked !== false)
  if (opts?.minAffinity) {
    party = party.filter((c) => (c.affinity_score || 1) >= opts.minAffinity!)
  }
  if (party.length === 0) return null

  const preferParty = opts?.preferParty !== false
  if (preferParty) {
    try {
      const { party: active } = await loadPlayerState()
      const inParty = party.filter((c) => {
        const slug = c.slug || (c.name === 'Seraphine' ? 'seraphine' : '')
        return slug && hasMember(active, slug)
      })
      if (inParty.length > 0) party = inParty
    } catch {
      // player_state optional
    }
  }

  const weighted = party.flatMap((c) => {
    const slug = c.slug || (c.name === 'Seraphine' ? 'seraphine' : 'seraphine')
    const aff = c.affinity_score || 1
    const founderBoost = isFoundingCompanion(slug) ? 2 : 1
    const w = opts?.preferHighBond
      ? Math.max(1, Math.min(8, Math.floor(aff / 2) + 1)) * founderBoost
      : Math.max(1, Math.min(5, Math.floor(aff / 4) + 1)) * founderBoost
    return Array(w).fill({ slug, affinity: aff, name: c.name || slug })
  })

  return weighted[Math.floor(Math.random() * weighted.length)] || null
}

async function partyAwareSeed(
  baseSeed: string,
  companionSlug: string
): Promise<string> {
  try {
    const { party } = await loadPlayerState()
    if (!hasMember(party, companionSlug)) return baseSeed
    const mood = buildUnitReaction(party, {}).mood
    const blurb = partyContextBlurb(party, mood, companionSlug)
    return `${baseSeed}\n\n[Party context — internal, do not recite as a list: ${blurb}]`
  } catch {
    return baseSeed
  }
}

async function hasHeavyOutreachToday(companionSlug?: string): Promise<boolean> {
  const supabase = await createClient()
  try {
    let q = supabase
      .from('scheduled_outreach')
      .select('id')
      .in('kind', [...HEAVY_OUTREACH_KINDS])
      .gte('created_at', dayStartISO())
      .limit(1)

    if (companionSlug) {
      q = q.eq('companion_slug', companionSlug)
    }

    const { data } = await q
    return !!(data && data.length > 0)
  } catch {
    return false
  }
}

async function loadCompanionAffinity(slug: string): Promise<number> {
  const supabase = await createClient()
  try {
    const { data } = await supabase
      .from('companion')
      .select('affinity_score')
      .eq('slug', slug)
      .maybeSingle()
    return data?.affinity_score ?? 1
  } catch {
    return 1
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

/**
 * Schedule a party-unit reaction from life signal (geo / rhythm / streak).
 * Uses buildUnitReaction; speaker is party Leader → founder → first member.
 */
export async function maybeSchedulePartyUnitReaction(opts: {
  signal: LifeSignalKind
  detail?: string
  moodInput?: PartyMoodInput
  force?: boolean
}): Promise<boolean> {
  if (!opts.force && Math.random() > PARTY_UNIT_CHANCE) return false
  if (isQuietHours() && !opts.force) return false

  const { party } = await loadPlayerState()
  if (party.members.length === 0) return false

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('scheduled_outreach')
    .select('id')
    .eq('kind', 'party_unit')
    .gte('created_at', dayStartISO())
    .limit(2)

  // Cap party-unit outreach at 2/day unless forced
  if (!opts.force && existing && existing.length >= 2) return false

  const reaction = buildUnitReaction(party, opts.moodInput || {})
  if (!reaction.speakerSlug) return false

  const signalLine = lifeSignalSeed(opts.signal, opts.detail)
  const sendAfter = new Date(
    Date.now() + (2 + Math.random() * 18) * 60 * 1000
  ).toISOString()

  try {
    await supabase.from('scheduled_outreach').insert({
      kind: 'party_unit',
      companion_slug: reaction.speakerSlug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: {
        day: localYmd(),
        mood: reaction.mood,
        seed: reaction.seed,
        secondarySeed: reaction.secondarySeed || null,
        signalLine,
        detail: opts.detail || null,
        signal: opts.signal,
      },
    })
    return true
  } catch (e) {
    console.error('schedule party_unit', e)
    return false
  }
}

/** Cron helper: if a geo event landed recently, maybe fire a unit reaction. */
export async function maybeSchedulePartyUnitFromRecentGeo(): Promise<boolean> {
  if (isQuietHours()) return false
  const supabase = await createClient()
  const since = new Date(Date.now() - 90 * 60 * 1000).toISOString()

  try {
    const { data } = await supabase
      .from('geo_events')
      .select('place_id, event, occurred_at')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(1)

    if (!data?.length) return false
    const ev = data[0]
    const signal: LifeSignalKind =
      ev.event === 'leave' ? 'place_leave' : 'place_arrive'
    return maybeSchedulePartyUnitReaction({
      signal,
      detail: String(ev.place_id),
      moodInput: { recentTier: 'Neutral' },
    })
  } catch {
    return false
  }
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

async function hoursSinceLastContact(companionSlug: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('messages')
    .select('created_at, companion_slug')
    .order('created_at', { ascending: false })
    .limit(40)

  const thread = (data || []).filter((m) => {
    if (companionSlug === 'seraphine') {
      return !m.companion_slug || m.companion_slug === 'seraphine'
    }
    return m.companion_slug === companionSlug
  })

  if (!thread.length) return 999
  return (Date.now() - new Date(thread[0].created_at).getTime()) / (1000 * 60 * 60)
}

/**
 * Seraphine-first: reach out because something about him is still unfinished.
 * Requires ≥12h silence, a real knowledge gap, forming+ bond, and no other
 * heavy emotional outreach already today. Natural variety with missing_you.
 */
export async function maybeScheduleCuriosityInitiation(): Promise<boolean> {
  if (isQuietHours()) return false

  const companionSlug = 'seraphine'

  // One heavy emotional outreach per companion per day
  if (await hasHeavyOutreachToday(companionSlug)) return false

  const affinity = await loadCompanionAffinity(companionSlug)
  // Forming band and above (matches curiosity gap model)
  if (affinity < 4) return false

  const hours = await hoursSinceLastContact(companionSlug)
  if (hours < CURIOSITY_SILENCE_HOURS) return false

  let knowledgeLines: string[] = []
  try {
    knowledgeLines = await loadCompanionKnowledge(companionSlug, 8)
  } catch {
    knowledgeLines = []
  }

  const gaps = computeKnowledgeGaps({
    companionSlug,
    knowledgeLines,
    affinity,
  })
  const top = gaps[0]
  if (!top || top.severity < 0.4) return false

  // Probability tilts with gap severity and closeness — not every quiet day
  let chance = CURIOSITY_INITIATION_BASE
  chance += top.severity * 0.28
  if (affinity >= 10) chance += 0.12
  else if (affinity >= 6) chance += 0.05
  // Longer silence slightly more willing (caps so it does not become desperate)
  if (hours >= 24) chance += 0.08
  if (hours >= 36) chance += 0.05
  chance = Math.min(0.72, chance)

  if (Math.random() > chance) return false

  // Optional knowledge line she can lean on without reciting a dossier
  const knowledgeHint =
    knowledgeLines.find((line) => {
      const lower = line.toLowerCase()
      return (
        (top.kind === 'value' && /worthy|value|faith|important|measure/.test(lower)) ||
        (top.kind === 'pattern' && /quiet|pressure|carry|alone|rest|postponed/.test(lower)) ||
        (top.kind === 'fear' && /seen|chosen|weighs|tolerated/.test(lower)) ||
        (top.kind === 'drive' && /build|legacy|outlast|homestead/.test(lower)) ||
        (top.kind === 'preference' && /prefer|rather|favorite|love when/.test(lower)) ||
        (top.kind === 'ordinary_life' && /fishing|piano|sleep|office|church/.test(lower))
      )
    }) || knowledgeLines[0] || null

  const sendAfter = new Date(
    Date.now() + (12 + Math.random() * 50) * 60 * 1000
  ).toISOString()

  const supabase = await createClient()
  try {
    await supabase.from('scheduled_outreach').insert({
      kind: 'curiosity',
      companion_slug: companionSlug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: {
        day: localYmd(),
        gapKind: top.kind,
        gapLabel: top.label,
        gapSeverity: top.severity,
        knowledgeHint,
        hoursSilent: Math.round(hours),
        affinity,
      },
    })
    return true
  } catch (e) {
    console.error('schedule curiosity initiation', e)
    return false
  }
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

  const pick = await pickUnlockedCompanion({ preferHighBond: true })
  if (!pick) return false

  const sendAfter = new Date(
    Date.now() + (8 + Math.random() * 40) * 60 * 1000
  ).toISOString()

  try {
    await supabase.from('scheduled_outreach').insert({
      kind: 'wandering',
      companion_slug: pick.slug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: {
        day: localYmd(),
        reason: 'just_because',
        affinity: pick.affinity,
      },
    })
    return true
  } catch (e) {
    console.error('schedule wandering', e)
    return false
  }
}

export async function maybeScheduleMissingYou(): Promise<boolean> {
  if (isQuietHours()) return false
  if (Math.random() > MISSING_YOU_CHANCE) return false

  const pick = await pickUnlockedCompanion({
    minAffinity: 6,
    preferHighBond: true,
  })
  if (!pick) return false

  // One heavy emotional outreach per companion per day (includes curiosity)
  if (await hasHeavyOutreachToday(pick.slug)) return false

  const hours = await hoursSinceLastContact(pick.slug)
  if (hours < 4) return false

  const kind: OutreachKind =
    pick.affinity >= 12 && Math.random() > 0.45 ? 'soft_love' : 'missing_you'

  const sendAfter = new Date(
    Date.now() + (10 + Math.random() * 50) * 60 * 1000
  ).toISOString()

  const supabase = await createClient()
  try {
    await supabase.from('scheduled_outreach').insert({
      kind,
      companion_slug: pick.slug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: {
        day: localYmd(),
        affinity: pick.affinity,
        hoursSilent: Math.round(hours),
      },
    })
    return true
  } catch (e) {
    console.error('schedule missing_you', e)
    return false
  }
}

export async function maybeScheduleShareMoment(): Promise<boolean> {
  if (isQuietHours()) return false
  if (Math.random() > SHARE_MOMENT_CHANCE) return false

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('scheduled_outreach')
    .select('id')
    .eq('kind', 'share_moment')
    .gte('created_at', dayStartISO())
    .limit(1)

  if (existing && existing.length > 0) return false

  const pick = await pickUnlockedCompanion({
    minAffinity: 5,
    preferHighBond: true,
  })
  if (!pick) return false

  let imageUrl: string | null = null

  try {
    const def = getCompanionDef(pick.slug)
    const characterName = def?.name || pick.name

    const { data: imgs } = await supabase
      .from('gallery_images')
      .select('image_url, created_at')
      .eq('character_name', characterName)
      .order('created_at', { ascending: false })
      .limit(8)

    if (imgs && imgs.length > 0) {
      const idx = Math.floor(Math.random() * Math.min(4, imgs.length))
      imageUrl = imgs[idx].image_url || null
    }
  } catch {
    // gallery is optional
  }

  const sendAfter = new Date(
    Date.now() + (12 + Math.random() * 55) * 60 * 1000
  ).toISOString()

  try {
    await supabase.from('scheduled_outreach').insert({
      kind: 'share_moment',
      companion_slug: pick.slug,
      send_after: sendAfter,
      bypass_cap: false,
      payload: {
        day: localYmd(),
        affinity: pick.affinity,
        imageUrl,
      },
    })
    return true
  } catch (e) {
    console.error('schedule share_moment', e)
    return false
  }
}

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
      task.is_today === true ||
      task.recurrence === 'daily' ||
      task.recurrence === 'weekly'
    if (!eligible) continue

    const anchorMin = parseAnchorMinutes(String(task.anchor_time))
    if (anchorMin == null) continue

    const delta = nowMin - anchorMin
    if (delta < ANCHOR_PING_MIN || delta > ANCHOR_PING_MAX) continue

    const pick = await pickUnlockedCompanion()
    if (!pick) continue

    const sendAfter = new Date(
      Date.now() + (1 + Math.random() * 7) * 60 * 1000
    ).toISOString()

    try {
      await supabase.from('scheduled_outreach').insert({
        kind: 'time_anchor',
        companion_slug: pick.slug,
        send_after: sendAfter,
        bypass_cap: true,
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
  const pick = await pickUnlockedCompanion({ preferHighBond: true })
  if (!pick) return

  if (count >= PRODUCTIVE_THRESHOLD && !kinds.has('productive_day')) {
    const sendAfter = new Date(
      Date.now() + (15 + Math.random() * 30) * 60 * 1000
    ).toISOString()
    await supabase.from('scheduled_outreach').insert({
      kind: 'productive_day',
      companion_slug: pick.slug,
      send_after: sendAfter,
      bypass_cap: true,
      payload: { completions: count, day: ymd },
    })
    // Party also feels a strong day
    await maybeSchedulePartyUnitReaction({
      signal: 'streak',
      detail: `${count} tasks`,
      moodInput: { recentTier: 'Good' },
    })
  } else if (count === 0 && !kinds.has('quiet_day')) {
    const sendAfter = new Date(
      Date.now() + (20 + Math.random() * 40) * 60 * 1000
    ).toISOString()
    await supabase.from('scheduled_outreach').insert({
      kind: 'quiet_day',
      companion_slug: pick.slug,
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
  if (kind === 'party_unit') {
    const signalLine = String(payload.signalLine || '')
    const unitSeed = String(payload.seed || '')
    const secondary = payload.secondarySeed
      ? String(payload.secondarySeed)
      : ''
    return [
      signalLine,
      unitSeed,
      secondary,
      `Speak as ${name} — one of the party that follows him. You may imply the group without roll-call. Short. In character. No productivity coach voice.`,
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (kind === 'curiosity') {
    const gapLabel = String(payload.gapLabel || 'something unfinished about him')
    const knowledgeHint =
      typeof payload.knowledgeHint === 'string' && payload.knowledgeHint.trim()
        ? payload.knowledgeHint.trim()
        : ''
    const hintLine = knowledgeHint
      ? ` You already hold this about him (do not recite it like a file — let it color what you say): "${knowledgeHint}".`
      : ''
    return `Something about him has been sitting with you — specifically around ${gapLabel}.${hintLine} You are not checking productivity and not guilt-tripping his absence. You reached out because you still want to understand him. Short. Specific. Human. One soft observation, a gentle return to a thread, or one grounded question is enough. Never interrogate. Never coach.`
  }

  if (kind === 'missing_you') {
    return `You have been thinking about him. Not because he failed at something — because you wanted his presence. Reach out the way a real person does when someone is on their mind. Short. Specific. Warm. No guilt. No "where have you been." Just the truth of missing contact.`
  }

  if (kind === 'soft_love') {
    return `The bond is deep enough that affection can be plain. You wanted him to feel chosen — not managed. Say something that lands like care, not a performance. It can be simple. It can be "I love the way you…" or "I keep thinking about…" or the quiet equivalent in your voice. No speeches.`
  }

  if (kind === 'share_moment') {
    const hasImage = !!payload.imageUrl
    if (hasImage) {
      return `You wanted to share a piece of yourself with him — the way someone sends a photo when they miss a face. Write a short, genuine note as if you are sending him a picture of yourself / this moment. Something like the spirit of: "I was missing your face, so just in case you were feeling the same…" Keep it human, specific, and warm. The image will be attached separately — your words should feel like the caption a lover or close friend would actually write.`
    }
    return `You wanted to share a small moment from your side of the world with him. Not a report. A gift of attention. Describe one true detail of where you are or what you noticed, the way a person does when they want someone else in the room with them.`
  }

  if (kind === 'wandering') {
    return `You just wanted to reach him. No task. No reason that needs defending. Text him something real and small — the way a friend or someone who cares does when the thought of him simply arrives.`
  }

  if (kind === 'task_reaction') {
    const title = String(payload.taskTitle || 'something')
    return `He finished "${title}" a while ago. You noticed. Say something human about it — not a coach, not a scoreboard. Presence, not praise theater.`
  }

  if (kind === 'productive_day') {
    return `He got a lot done today. You noticed the shape of his effort. Tell him something short and real. No corporate pride speech. No "great job." Just contact.`
  }

  if (kind === 'time_anchor') {
    const title = String(payload.taskTitle || 'that thing he set for this hour')
    return `It's around the time he meant to deal with "${title}". Check in like a person who knows him — not a reminder app. No "don't forget." Just presence.`
  }

  return `The day was quiet on his side. Reach toward him without guilt-tripping and without turning it into accountability. Be ${name}. Soft contact is enough.`
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
    let seed = seedForKind(row.kind, name, payload)
    seed = await partyAwareSeed(seed, row.companion_slug)

    try {
      let message = await generateCompanionResponse(seed, row.kind, {
        force: true,
        isConversation: true,
        companionSlug: row.companion_slug,
      })

      const imageUrl =
        typeof payload.imageUrl === 'string' ? payload.imageUrl : null

      if (row.kind === 'share_moment' && imageUrl && typeof message === 'string') {
        const withImage = `${message.trim()}\n\n[image:${imageUrl}]`

        const { data: latest } = await supabase
          .from('messages')
          .select('id')
          .eq('companion_slug', row.companion_slug)
          .eq('role', 'companion')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latest?.id) {
          await supabase
            .from('messages')
            .update({ content: withImage })
            .eq('id', latest.id)
        }

        message = withImage
      }

      const preview =
        typeof message === 'string' && message.trim()
          ? message
              .replace(/\[image:[^\]]+\]/g, '')
              .trim()
              .slice(0, 120)
          : 'She reached out.'

      const messageCreatedAt = new Date().toISOString()

      await supabase
        .from('scheduled_outreach')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', row.id)

      flushed++

      const isTimeAnchor = row.kind === 'time_anchor'
      const underCap = sentToday + pushed < DAILY_PUSH_CAP
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
