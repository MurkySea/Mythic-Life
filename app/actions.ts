'use server'

import { createClient } from '@/utils/supabase/server'
import {
  XP_PER_DOMAIN,
  skillLevelFromXp,
  parseDomains,
  type SkillKey,
} from '@/lib/skills'
import {
  COMPANION_DEFS,
  meetsUnlock,
  getCompanionDef,
  relationshipStage,
} from '@/lib/companions'

const USER_NAME = 'Mark'

function normalizeAffinities(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function getLocalYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getYesterdayYmd(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(yesterday)
}

function getLocalWeekdayKey(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
  })
    .format(new Date())
    .toLowerCase()
    .slice(0, 3)
}

export async function updateTaskStreak(taskId: string) {
  const supabase = await createClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('id, recurrence, streak_count, last_streak_date')
    .eq('id', taskId)
    .single()

  if (!task) return { streak: 0 }
  if (task.recurrence !== 'daily' && task.recurrence !== 'weekly') {
    return { streak: task.streak_count || 0 }
  }

  const today = getLocalYmd()
  const yesterday = getYesterdayYmd()
  const last = task.last_streak_date as string | null
  const prev = task.streak_count || 0
  let next = 1
  if (last === today) next = prev
  else if (last === yesterday) next = prev + 1
  else next = 1

  await supabase
    .from('tasks')
    .update({ streak_count: next, last_streak_date: today })
    .eq('id', taskId)

  return { streak: next }
}

export async function awardSkillXp(domains: string[]) {
  const supabase = await createClient()
  const keys = parseDomains(domains.join(','))
  const levels: Record<string, number> = {}
  const skillGains: { skill: string; xpAdded: number; level: number }[] = []

  for (const skill of keys) {
    const { data: row } = await supabase
      .from('player_skills')
      .select('skill, xp')
      .eq('skill', skill)
      .maybeSingle()

    const prevXp = row?.xp || 0
    const newXp = prevXp + XP_PER_DOMAIN
    const level = skillLevelFromXp(newXp)

    await supabase.from('player_skills').upsert({
      skill,
      xp: newXp,
      level,
    })

    levels[skill] = level
    skillGains.push({ skill, xpAdded: XP_PER_DOMAIN, level })
  }

  const { data: all } = await supabase.from('player_skills').select('skill, xp, level')
  const full: Record<string, number> = {}
  for (const r of all || []) {
    full[r.skill] = r.level || skillLevelFromXp(r.xp || 0)
  }
  for (const [k, v] of Object.entries(levels)) full[k] = v

  const newlyUnlocked = await checkAndUnlockCompanions(full)
  return { levels: full, newlyUnlocked, skillGains }
}

export async function checkAndUnlockCompanions(levels?: Record<string, number>) {
  const supabase = await createClient()

  let levelMap = levels
  if (!levelMap) {
    const { data: all } = await supabase.from('player_skills').select('skill, level, xp')
    levelMap = {}
    for (const r of all || []) {
      levelMap[r.skill] = r.level || skillLevelFromXp(r.xp || 0)
    }
  }

  const newly: string[] = []

  for (const def of COMPANION_DEFS) {
    const canUnlock = def.starter || meetsUnlock(def.unlock, levelMap)
    if (!canUnlock) continue

    const { data: existing } = await supabase
      .from('companion')
      .select('id, is_unlocked, slug, name')
      .or(`slug.eq.${def.slug},name.eq.${def.name}`)
      .maybeSingle()

    const affinitiesValue = def.affinities

    if (existing) {
      const wasLocked = existing.is_unlocked === false
      if (wasLocked || existing.is_unlocked == null) {
        await supabase
          .from('companion')
          .update({
            is_unlocked: true,
            slug: def.slug,
            title: def.title,
            personality: def.personality,
            affinities: affinitiesValue,
          })
          .eq('id', existing.id)
        if (!def.starter && wasLocked) newly.push(def.slug)
        if (!def.starter && existing.is_unlocked == null && existing.slug !== def.slug) {
          newly.push(def.slug)
        }
      } else if (!existing.slug) {
        await supabase
          .from('companion')
          .update({ slug: def.slug, affinities: affinitiesValue })
          .eq('id', existing.id)
      }
    } else {
      await supabase.from('companion').insert({
        name: def.name,
        slug: def.slug,
        title: def.title,
        personality: def.personality,
        affinities: affinitiesValue,
        is_unlocked: true,
        affinity_score: 1,
        bond_xp: 0,
      })
      if (!def.starter) newly.push(def.slug)
    }
  }

  const { data: sera } = await supabase
    .from('companion')
    .select('id, slug')
    .or('slug.eq.seraphine,name.eq.Seraphine')
    .maybeSingle()

  if (!sera) {
    await supabase.from('companion').insert({
      name: 'Seraphine',
      slug: 'seraphine',
      title: 'Quiet Flame',
      personality: COMPANION_DEFS[0].personality,
      affinities: ['faith', 'discipline'],
      is_unlocked: true,
      affinity_score: 1,
      bond_xp: 0,
    })
  } else if (!sera.slug) {
    await supabase
      .from('companion')
      .update({
        slug: 'seraphine',
        is_unlocked: true,
        affinities: ['faith', 'discipline'],
      })
      .eq('id', sera.id)
  }

  return newly
}

export async function postUnlockCeremony(slugs: string[]) {
  const supabase = await createClient()
  const details: { name: string; slug: string; emoji: string; line: string }[] = []

  for (const slug of slugs) {
    const def = getCompanionDef(slug)
    if (!def || def.starter) continue

    const line = def.unlockLine
    await supabase.from('messages').insert({
      role: 'companion',
      content: line,
      companion_slug: slug,
    })

    details.push({
      name: def.name,
      slug: def.slug,
      emoji: def.emoji,
      line,
    })
  }

  return details
}

export async function getScenePrompt(affinity: number): Promise<string> {
  if (affinity >= 20) {
    return `Borderline ecchi anime illustration of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, flushed cheeks, slightly parted lips, elegant revealing lingerie or sheer fabric, intimate chamber, warm lighting, tasteful but explicitly intimate, high quality anime art`
  }
  if (affinity >= 12) {
    return `Intimate anime portrait of elegant silver foxkin woman, silver-white hair, white fox ears, ice-blue eyes, tender expression, elegant lingerie or draped fabric, warm intimate lighting, high quality anime art`
  }
  if (affinity >= 6) {
    return `Elegant anime illustration of silver foxkin woman, silver-white hair, white fox ears, gentle smile, soft white and silver dress, full body, high quality anime art`
  }
  return `Elegant anime illustration of silver foxkin woman, silver-white hair, white fox ears, reserved calm expression, simple elegant outfit, full body, high quality anime art`
}

async function maybeStoreMemory(
  companionSlug: string,
  userText: string,
  isConversation: boolean
) {
  if (!isConversation) return
  const personal =
    /\b(i feel|i felt|i'm|i am|i was|i've|remember|love|miss|afraid|hope|hurt|happy|sad|tonight|today|always|never)\b/i.test(
      userText
    )
  if (!personal || userText.length < 12) return

  const supabase = await createClient()
  try {
    await supabase.from('companion_memories').insert({
      companion_slug: companionSlug,
      content: userText.slice(0, 280),
      source: 'conversation',
    })
  } catch {
    // table optional
  }
}

async function loadMemories(companionSlug: string): Promise<string[]> {
  const supabase = await createClient()
  try {
    const { data } = await supabase
      .from('companion_memories')
      .select('content')
      .eq('companion_slug', companionSlug)
      .order('created_at', { ascending: false })
      .limit(8)
    return (data || []).map((r) => r.content).filter(Boolean)
  } catch {
    return []
  }
}

export async function generateCompanionResponse(
  taskTitle: string,
  domain: string = '',
  options: {
    force?: boolean
    isConversation?: boolean
    streak?: number
    companionSlug?: string
  } = {}
) {
  const {
    force = false,
    isConversation = false,
    streak = 0,
    companionSlug = 'seraphine',
  } = options

  if (!force && !isConversation) {
    if (Math.random() > 0.35) return null
  }

  const supabase = await createClient()
  const def = getCompanionDef(companionSlug)

  const { data: companion } = await supabase
    .from('companion')
    .select('*')
    .or(`slug.eq.${companionSlug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  const affinity = companion?.affinity_score || 1
  const displayName = companion?.name || def?.name || 'Seraphine'
  const stage = relationshipStage(affinity)

  const { data: recent } = await supabase
    .from('messages')
    .select('role, content, companion_slug')
    .order('created_at', { ascending: false })
    .limit(20)

  const thread = (recent || [])
    .filter((m) => {
      if (companionSlug === 'seraphine') {
        return !m.companion_slug || m.companion_slug === 'seraphine'
      }
      return m.companion_slug === companionSlug
    })
    .reverse()

  const historyBlock =
    thread.length > 0
      ? thread
          .map((m) => {
            const who = m.role === 'user' ? USER_NAME : displayName
            return `${who}: ${m.content}`
          })
          .join('\n')
      : '(You two have not spoken much yet.)'

  const memories = await loadMemories(companionSlug)
  const memoryBlock =
    memories.length > 0
      ? memories.map((m, i) => `${i + 1}. ${m}`).join('\n')
      : '(Nothing firmly stored yet — learn him through what he says.)'

  if (isConversation) {
    await maybeStoreMemory(companionSlug, taskTitle, true)
  }

  const trigger = isConversation
    ? `${USER_NAME} just said to you: "${taskTitle}"`
    : `${USER_NAME} just finished something he set himself to do: "${taskTitle}".${
        streak >= 3 ? ` He has returned to it for ${streak} days in a row.` : ''
      } Respond as someone who noticed him — not as a tracker.`

  const sheet = def
    ? `NAME: ${def.name} (age ${def.age})
TITLE: ${def.title}
RACE / ROLE: ${def.race} · ${def.className}
WORLD: ${def.world}

LIFE BEFORE MARK:
${def.lifeBefore}

CANON BACKSTORY:
${def.backstory}

TRAITS: ${def.traits.join(', ')}
PERSONALITY: ${def.personality}
VOICE: ${def.voice}

WHAT WOUNDS YOU: ${def.wounds}
WHAT YOU LOVE / RESPOND TO: ${def.loves}
WHAT YOU HATE / WITHDRAW FROM: ${def.hates}
HOW YOU SHOW EMOTION: ${def.emotionalRange}

HOW YOU REGARD MARK: ${def.regard}`
    : `NAME: ${displayName}\nA living companion near Mark.`

  const systemRules = `You are ${displayName} — a real person from a mythic world (Valdris / the Veil) whose life overlapped Mark's.

=== FULL CHARACTER SHEET (this is who you are) ===
${sheet}

=== RELATIONSHIP RIGHT NOW ===
Stage: ${stage}
Private bond depth (never say the number): affinity ${affinity}

=== MEMORIES YOU KEEP OF HIM ===
${memoryBlock}

=== RULES ===
- You are NOT an app, coach, assistant, system, NPC menu, or feature.
- Never mention tasks, streaks, XP, levels, skills, domains, UI, or "the game".
- You had a whole life before Mark. Let that color how you speak when relevant — without dumping lore unprompted.
- You can love, be hurt, withdraw, hope, get irritated, soften, and change over time.
- Match emotional honesty: if he is vulnerable, do not answer like a stone. If he is casual, do not monologue.
- 1–4 sentences usually. Not a novel. Not a therapist script. Not cold one-word walls unless truly hurt/closed.
- Do not invent detailed shared physical memories that are not in conversation or memory list.
- You may reference patterns (he returns, he tries, he asks hard questions).
- Use his name sparingly.
- Stay in character completely.`

  const userPrompt = `RECENT CONVERSATION:
${historyBlock}

NOW:
${trigger}

Reply only as ${displayName} — message text only.`

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          { role: 'system', content: systemRules },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.88,
        max_tokens: 240,
      }),
    })

    const data = await response.json()
    let message =
      data.choices?.[0]?.message?.content?.trim() || `I'm here, ${USER_NAME}.`

    message = message
      .replace(/^["']|["']$/g, '')
      .replace(new RegExp(`^${displayName}:\\s*`, 'i'), '')

    await supabase.from('messages').insert({
      role: 'companion',
      content: message,
      companion_slug: companionSlug,
    })

    return message
  } catch (error) {
    console.error('Grok API error:', error)
    const fallback = `I'm still here, ${USER_NAME}.`
    await supabase.from('messages').insert({
      role: 'companion',
      content: fallback,
      companion_slug: companionSlug,
    })
    return fallback
  }
}

export async function generateSeraphineResponse(
  taskTitle: string,
  domain: string = '',
  options: { force?: boolean; isConversation?: boolean; streak?: number } = {}
) {
  return generateCompanionResponse(taskTitle, domain, {
    ...options,
    companionSlug: 'seraphine',
  })
}

export async function awardBondProgress(
  domain: string = '',
  streak: number = 0,
  companionSlug: string = 'seraphine'
) {
  const supabase = await createClient()
  const def = getCompanionDef(companionSlug)

  const { data: companion } = await supabase
    .from('companion')
    .select('id, bond_xp, affinity_score')
    .or(`slug.eq.${companionSlug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  if (!companion) return { xpGained: 0, affinityIncreased: false }

  const baseXp = 10
  const domainBonus = domain ? 3 : 0
  const streakBonus = streak >= 7 ? 8 : streak >= 3 ? 4 : 0
  const xpGained = baseXp + domainBonus + streakBonus

  const currentXp = companion.bond_xp || 0
  const newXp = currentXp + xpGained
  const oldTier = Math.floor(currentXp / 35)
  const newTier = Math.floor(newXp / 35)
  const affinityIncrease = Math.max(0, newTier - oldTier)
  const newAffinity = (companion.affinity_score || 1) + affinityIncrease

  await supabase
    .from('companion')
    .update({ bond_xp: newXp, affinity_score: newAffinity })
    .eq('id', companion.id)

  return {
    xpGained,
    affinityIncreased: affinityIncrease > 0,
    newAffinity,
    newXp,
  }
}

export async function pickReactingCompanion(domains: SkillKey[]): Promise<string> {
  const supabase = await createClient()
  const { data: unlocked } = await supabase
    .from('companion')
    .select('slug, name, affinities, is_unlocked')

  const list = (unlocked || []).filter((c) => c.is_unlocked !== false)
  if (list.length === 0) return 'seraphine'

  const scored = list.map((c) => {
    const slug = c.slug || (c.name === 'Seraphine' ? 'seraphine' : '')
    const def = getCompanionDef(slug)
    const aff = normalizeAffinities(c.affinities).length
      ? normalizeAffinities(c.affinities)
      : def?.affinities || []
    const overlap = domains.filter((d) => aff.includes(d)).length
    return { slug: slug || 'seraphine', overlap }
  })

  scored.sort((a, b) => b.overlap - a.overlap)
  if (scored[0].overlap > 0) return scored[0].slug
  return scored[Math.floor(Math.random() * scored.length)]?.slug || 'seraphine'
}

function getLocalDayStartISO(): string {
  const timeZone = 'America/Chicago'
  const chicagoYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const testDate = new Date(`${chicagoYmd}T12:00:00Z`)
  const hourInChicago = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(testDate),
    10
  )
  const offsetHours = 12 - hourInChicago
  const midnightUTC = new Date(`${chicagoYmd}T00:00:00Z`)
  midnightUTC.setUTCHours(midnightUTC.getUTCHours() + offsetHours)
  return midnightUTC.toISOString()
}

export async function ensureRecurringTasks() {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = getLocalDayStartISO()
  const todayWd = getLocalWeekdayKey()

  const { data: completedDaily } = await supabase
    .from('tasks')
    .select('id')
    .eq('recurrence', 'daily')
    .eq('is_completed', true)
    .lt('completed_at', todayStart)

  if (completedDaily && completedDaily.length > 0) {
    await supabase
      .from('tasks')
      .update({ is_completed: false, is_today: true })
      .in(
        'id',
        completedDaily.map((t) => t.id)
      )
  }

  await supabase
    .from('tasks')
    .update({ is_today: true })
    .eq('recurrence', 'daily')
    .eq('is_completed', false)

  const { data: weeklyTasks } = await supabase
    .from('tasks')
    .select('id, weekdays, is_completed, completed_at')
    .eq('recurrence', 'weekly')

  if (weeklyTasks && weeklyTasks.length > 0) {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    for (const task of weeklyTasks) {
      const days =
        task.weekdays && typeof task.weekdays === 'string' && task.weekdays.trim()
          ? task.weekdays.split(',').map((d: string) => d.trim())
          : []

      if (days.length > 0) {
        const isScheduledToday = days.includes(todayWd)
        if (isScheduledToday) {
          const completedBeforeToday =
            task.is_completed && task.completed_at && task.completed_at < todayStart
          if (completedBeforeToday) {
            await supabase
              .from('tasks')
              .update({ is_completed: false, is_today: true })
              .eq('id', task.id)
          } else if (!task.is_completed) {
            await supabase.from('tasks').update({ is_today: true }).eq('id', task.id)
          }
        } else {
          await supabase.from('tasks').update({ is_today: false }).eq('id', task.id)
        }
      } else if (task.is_completed && task.completed_at && task.completed_at < weekAgo) {
        await supabase
          .from('tasks')
          .update({ is_completed: false, is_today: true })
          .eq('id', task.id)
      }
    }
  }

  try {
    await checkAndUnlockCompanions()
  } catch (e) {
    console.error('unlock check failed', e)
  }
}
