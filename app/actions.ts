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
} from '@/lib/companions'
import {
  buildCompanionSystemPrompt,
  buildCompanionUserPrompt,
  pickMood,
  replyTokenBudget,
  USER_NAME,
} from '@/lib/companionVoice'
import {
  loadPersistedMood,
  savePersistedMood,
  continueMood,
  moodForceFromUserText,
} from '@/lib/mood'
import {
  maybeCaptureMemory,
  loadBestMemories,
  maybeRecordAbsence,
  companionPrivateFocus,
} from '@/lib/memory'

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

function localHourChicago(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  )
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
  const { buildScenePrompt } = await import('@/lib/scenes')
  return buildScenePrompt(affinity, null, 0)
}

async function buildObservationBlock(companionSlug: string): Promise<string> {
  const supabase = await createClient()
  const lines: string[] = []

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('title, is_completed, completed_at, streak_count, domains, domain')
      .gte('completed_at', weekAgo)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(40)

    const completed = recentTasks || []
    if (completed.length >= 8) {
      lines.push('He has been consistently showing up this week — more than usual.')
    } else if (completed.length >= 4) {
      lines.push('He has been reasonably consistent the last few days.')
    } else if (completed.length <= 1) {
      lines.push('He has been quieter than usual the past few days. Less activity.')
    }

    const strongStreaks = completed.filter((t) => (t.streak_count || 0) >= 4)
    if (strongStreaks.length > 0) {
      lines.push('He has kept at least one promise for several days running.')
    }

    const domainCount: Record<string, number> = {}
    for (const t of completed) {
      const domains = parseDomains(t.domains, t.domain)
      for (const d of domains) {
        domainCount[d] = (domainCount[d] || 0) + 1
      }
    }
    const sorted = Object.entries(domainCount).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0 && sorted[0][1] >= 4) {
      const top = sorted[0][0]
      if (top === 'discipline' || top === 'fitness') {
        lines.push('He has been pushing hard on structure and effort lately.')
      } else if (top === 'faith') {
        lines.push('He has been leaning into faith and quiet practice more than usual.')
      } else if (top === 'knowledge') {
        lines.push('He has been feeding his mind — reading, learning, thinking.')
      } else if (top === 'relations') {
        lines.push('He has been putting energy into people and relationships.')
      }
    }

    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('created_at, role, companion_slug')
      .order('created_at', { ascending: false })
      .limit(30)

    const thread = (lastMsgs || []).filter((m) => {
      if (companionSlug === 'seraphine') {
        return !m.companion_slug || m.companion_slug === 'seraphine'
      }
      return m.companion_slug === companionSlug
    })

    if (thread.length > 0) {
      const last = new Date(thread[0].created_at).getTime()
      const hoursSilent = (Date.now() - last) / (1000 * 60 * 60)
      if (hoursSilent > 36) {
        lines.push('He has been quieter with her than usual. A noticeable gap.')
      } else if (hoursSilent > 18) {
        lines.push('It has been a while since they last spoke.')
      }
    }

    const { data: comp } = await supabase
      .from('companion')
      .select('affinity_score, bond_xp')
      .or(`slug.eq.${companionSlug},name.eq.Seraphine`)
      .maybeSingle()

    const aff = comp?.affinity_score || 1
    if (aff >= 12) {
      lines.push('The bond between them is no longer new. There is real history now.')
    } else if (aff >= 6) {
      lines.push('Trust is forming. They are past the early careful stage.')
    }
  } catch (e) {
    console.error('observation build failed', e)
  }

  if (lines.length === 0) {
    return '(Nothing strong to notice yet. Learn him from what he actually says and does.)'
  }

  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
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

  const { data: recent } = await supabase
    .from('messages')
    .select('role, content, companion_slug')
    .order('created_at', { ascending: false })
    .limit(24)

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
      : '(Little shared history yet. Do not force intimacy.)'

  const lastUser = [...thread].reverse().find((m) => m.role === 'user')?.content
  const lastCompanion = [...thread].reverse().find((m) => m.role === 'companion')?.content

  // Long-term memory ranked by importance + recency
  const memoryLines = await loadBestMemories(companionSlug, 14)

  // Automatic absence observation (forms private memory when he has been gone)
  const absenceNote = await maybeRecordAbsence(companionSlug)

  // Companion private focus / agency seed — something she is carrying that is not only about him
  const privateFocus = companionPrivateFocus(companionSlug)

  const memoryParts: string[] = []
  if (memoryLines.length > 0) memoryParts.push(...memoryLines)
  if (absenceNote) memoryParts.push(`(Private) ${absenceNote}`)
  memoryParts.push(`(Her private focus) ${privateFocus}`)

  const memoryBlock =
    memoryParts.length > 0
      ? memoryParts.map((m, i) => `${i + 1}. ${m}`).join('\n')
      : '(Nothing stored yet — learn him from what he actually says and does.)'

  if (isConversation) {
    await maybeCaptureMemory(companionSlug, taskTitle)
  }

  const observationBlock = await buildObservationBlock(companionSlug)

  const userText = isConversation ? taskTitle : lastUser || ''
  const candidate = pickMood({
    affinity,
    hour: localHourChicago(),
    lastUserText: userText,
    lastCompanionText: lastCompanion,
  })

  const persisted = await loadPersistedMood(companion?.id)
  const forceMood = moodForceFromUserText(userText)
  const mood = continueMood(persisted?.mood, candidate, forceMood)

  const maxTokens = replyTokenBudget(taskTitle, affinity)
  const depthMode = maxTokens >= 220

  const systemRules = buildCompanionSystemPrompt({
    def,
    displayName,
    affinity,
    mood,
    memoryBlock,
    historyBlock,
    observationBlock,
    depthMode,
  })

  const userPrompt = buildCompanionUserPrompt({
    displayName,
    isConversation,
    triggerText: taskTitle,
    streak,
    mood,
    depthMode,
  })

  const temperature = 0.88 + Math.random() * 0.12

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
        temperature,
        max_tokens: maxTokens,
      }),
    })

    const data = await response.json()
    let message =
      data.choices?.[0]?.message?.content?.trim() || `Still here.`

    message = message
      .replace(/^["']|["']$/g, '')
      .replace(new RegExp(`^${displayName}\s*:\s*`, 'i'), '')
      .replace(/^\*[^*]+\*\s*/g, '')
      .trim()

    await supabase.from('messages').insert({
      role: 'companion',
      content: message,
      companion_slug: companionSlug,
    })

    await savePersistedMood(companion?.id, mood)

    return message
  } catch (error) {
    console.error('Grok API error:', error)
    const fallback = `I'm still here.`
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
