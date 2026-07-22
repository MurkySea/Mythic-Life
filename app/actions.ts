'use server'

import { createClient } from '@/utils/supabase/server'

const USER_NAME = 'Mark'

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

/** Local weekday key: mon, tue, wed, thu, fri, sat, sun */
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

function getDialogueStyle(affinity: number): string {
  if (affinity >= 20) {
    return `You share an intense, private, and deeply sensual bond with ${USER_NAME}. Speak with quiet heat, soft desire, and intimate tenderness. Use his name naturally. Your words can be openly affectionate, slightly teasing, and carry clear romantic and sensual undertones while remaining elegant and never vulgar.`
  }
  if (affinity >= 16) {
    return `You feel a strong, heated intimacy with ${USER_NAME}. Speak with warmth, soft desire, and emotional closeness. Use his name. Gentle teasing and subtle sensuality are natural. Stay elegant even when the mood turns more intimate.`
  }
  if (affinity >= 12) {
    return `You share a deep, private intimacy with ${USER_NAME}. Speak with quiet tenderness and soft romantic undertones. Use his name. Be personal, vulnerable, and gently sensual while remaining elegant.`
  }
  if (affinity >= 9) {
    return `You feel a strong intimacy with ${USER_NAME}. Speak warmly and tenderly. Use his name. Soft affection and emotional closeness come naturally.`
  }
  if (affinity >= 6) {
    return `You have grown close to ${USER_NAME}. Speak with genuine warmth and soft affection. Use his name when it feels natural.`
  }
  if (affinity >= 3) {
    return `You are becoming familiar with ${USER_NAME}. Speak with quiet warmth and supportive presence. You may use his name.`
  }
  return `You are a calm, warm, quietly strong companion to ${USER_NAME}. Speak with kindness and quiet respect. You may use his name sparingly.`
}

export async function getScenePrompt(affinity: number): Promise<string> {
  if (affinity >= 20) {
    return `Borderline ecchi anime illustration of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, refined beautiful face with flushed cheeks and slightly parted lips, soft sensual expression, wearing elegant revealing lingerie or loosely draped sheer white fabric that clings to her body, intimate bedroom or private chamber setting, warm golden intimate lighting, close three-quarter view, clear soft sensuality, high quality detailed anime art, tasteful but explicitly intimate`
  }
  if (affinity >= 16) {
    return `Intimate anime illustration of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, soft desirous expression, wearing elegant lingerie or a partially open silver-white outfit that reveals soft skin, warm private lighting, close personal framing, romantic and softly sensual atmosphere, full body or three-quarter view, high quality detailed anime art`
  }
  if (affinity >= 12) {
    return `Intimate anime portrait of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, tender vulnerable expression, wearing elegant white lingerie or loosely draped soft fabric, warm intimate lighting, close framing, quiet romantic atmosphere, full body or three-quarter view, high quality detailed anime art`
  }
  if (affinity >= 9) {
    return `Warm anime illustration of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, soft affectionate smile, wearing a slightly revealing elegant white and silver outfit with flowing fabric, gentle private lighting, closer framing, calm romantic atmosphere, full body visible, high quality detailed anime art`
  }
  if (affinity >= 6) {
    return `Elegant anime illustration of a silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, gentle warm smile, wearing a soft elegant white and silver dress with flowing lines, soft natural lighting, graceful standing pose, calm affectionate presence, full body visible, high quality detailed anime art`
  }
  if (affinity >= 3) {
    return `Elegant anime illustration of a silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, calm confident expression, wearing a simple elegant white and silver outfit, soft lighting, graceful standing pose, serene otherworldly presence, full body visible, high quality detailed anime art`
  }
  return `Elegant anime illustration of a silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, reserved calm expression, wearing a simple clean white and silver outfit with flowing lines, soft lighting, graceful standing pose, distant serene presence, full body visible, high quality detailed anime art`
}

export async function generateSeraphineResponse(
  taskTitle: string,
  domain: string = '',
  options: { force?: boolean; isConversation?: boolean; streak?: number } = {}
) {
  const { force = false, isConversation = false, streak = 0 } = options

  if (!force && !isConversation) {
    if (Math.random() > 0.35) return null
  }

  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('affinity_score, personality, personality_long, title')
    .single()

  const affinity = companion?.affinity_score || 1
  const style = getDialogueStyle(affinity)

  const personalityCore =
    companion?.personality_long ||
    companion?.personality ||
    `Calm, warm, and quietly strong. Deeply values faithfulness, integrity, and small daily obedience. Notices consistency more than intensity. Will celebrate when ${USER_NAME} shows up in ordinary ways and gently (sometimes firmly) holds him accountable when he drifts. Speaks with kindness and clarity — never nagging, but she doesn't let things slide.`

  const streakNote =
    streak >= 3
      ? ` He is on a ${streak}-day streak for this task — consistency matters to you; acknowledge it naturally if it fits.`
      : ''

  const contextLine = isConversation
    ? `${USER_NAME} just said to you: "${taskTitle}"`
    : `${USER_NAME} just completed the task: "${taskTitle}"${domain ? ` (Domain: ${domain})` : ''}.${streakNote}`

  const prompt = `You are Seraphine, a silver foxkin companion. Your title is "${companion?.title || 'Quiet Flame'}".

CORE PERSONALITY:
${personalityCore}

RELATIONSHIP DEPTH:
${style}

You know the man you are speaking to is named ${USER_NAME}. Always address him as ${USER_NAME} or with natural warmth — never call him "user".

${contextLine}

Write a short, living reply (2-4 sentences). Sound like a real person with a distinct voice — not a generic motivational bot. Let your personality show: quiet strength, care for consistency, gentle accountability, and the current intimacy of your bond. Do not be cold or formulaic.`

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 320,
      }),
    })

    const data = await response.json()
    const message =
      data.choices?.[0]?.message?.content ||
      `I saw that, ${USER_NAME}. The small choices still matter.`

    await supabase.from('messages').insert({
      role: 'companion',
      content: message,
    })

    return message
  } catch (error) {
    console.error('Grok API error:', error)
    const fallback = `I noticed, ${USER_NAME}. Keep going.`
    await supabase.from('messages').insert({
      role: 'companion',
      content: fallback,
    })
    return fallback
  }
}

export async function awardBondProgress(domain: string = '', streak: number = 0) {
  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('id, bond_xp, affinity_score')
    .single()

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

  // ── Daily ───────────────────────────────────────────────────────────────────
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

  // ── Weekly with optional weekdays ───────────────────────────────────────────
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
        // Specific weekdays (e.g. mon,thu)
        const isScheduledToday = days.includes(todayWd)

        if (isScheduledToday) {
          const completedBeforeToday =
            task.is_completed &&
            task.completed_at &&
            task.completed_at < todayStart

          if (completedBeforeToday) {
            await supabase
              .from('tasks')
              .update({ is_completed: false, is_today: true })
              .eq('id', task.id)
          } else if (!task.is_completed) {
            await supabase.from('tasks').update({ is_today: true }).eq('id', task.id)
          }
        } else {
          // Not a scheduled day — pull off Today
          await supabase.from('tasks').update({ is_today: false }).eq('id', task.id)
        }
      } else {
        // Legacy weekly with no days: reset once every ~7 days
        if (
          task.is_completed &&
          task.completed_at &&
          task.completed_at < weekAgo
        ) {
          await supabase
            .from('tasks')
            .update({ is_completed: false, is_today: true })
            .eq('id', task.id)
        }
      }
    }
  }
}
