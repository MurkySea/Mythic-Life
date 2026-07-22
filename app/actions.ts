'use server'

import { createClient } from '@/utils/supabase/server'

/**
 * Returns a dialogue style description based on current Affinity.
 * Higher Affinity = warmer, more intimate, more personal language.
 */
function getDialogueStyle(affinity: number): string {
  if (affinity >= 10) {
    return `You are deeply bonded with the user. Speak with quiet intimacy and tenderness. Your words can be soft, personal, and carry romantic or deeply affectionate undertones. You feel close enough to be vulnerable and private with them. Still calm and elegant, never crude.`
  }
  if (affinity >= 7) {
    return `You feel a strong, growing intimacy with the user. Speak warmly and personally. Soft affection and emotional closeness are natural. You can be gently tender and let your care show more openly.`
  }
  if (affinity >= 4) {
    return `You have grown closer to the user. Speak with genuine warmth and personal care. You are more open, supportive, and softly affectionate while remaining elegant and composed.`
  }
  // Default / low affinity
  return `You are a calm, warm, quietly strong companion. Speak with kindness, clarity, and quiet respect. You are supportive but still somewhat reserved.`
}

export async function generateSeraphineResponse(taskTitle: string, domain: string = '') {
  const supabase = await createClient()

  // Get current affinity so the dialogue can reflect the relationship depth
  const { data: companion } = await supabase
    .from('companion')
    .select('affinity_score')
    .single()

  const affinity = companion?.affinity_score || 1
  const style = getDialogueStyle(affinity)

  const prompt = `You are Seraphine, a silver foxkin companion who values faith, discipline, and integrity.

${style}

The user just completed the task: "${taskTitle}"${domain ? ` (Domain: ${domain})` : ''}.

Write a short, personal reaction (2-4 sentences). Make it feel like a real conversation that matches the current depth of your bond.`

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
        max_tokens: 300,
      }),
    })

    const data = await response.json()
    const message = data.choices?.[0]?.message?.content || 
      "I noticed that. Keep going. I'm proud of the small choices you're making."

    await supabase.from('messages').insert({
      role: 'companion',
      content: message,
    })

    return message
  } catch (error) {
    console.error('Grok API error:', error)
    const fallback = "I noticed that. Keep going. I'm proud of the small choices you're making."
    
    await supabase.from('messages').insert({
      role: 'companion',
      content: fallback,
    })
    
    return fallback
  }
}

/**
 * Awards Bond XP for completing a task and increases Affinity when thresholds are crossed.
 */
export async function awardBondProgress(domain: string = '') {
  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('id, bond_xp, affinity_score')
    .single()

  if (!companion) return { xpGained: 0, affinityIncreased: false }

  const baseXp = 10
  const domainBonus = domain ? 3 : 0
  const xpGained = baseXp + domainBonus

  const currentXp = companion.bond_xp || 0
  const newXp = currentXp + xpGained

  // Affinity increases every 50 Bond XP
  const oldTier = Math.floor(currentXp / 50)
  const newTier = Math.floor(newXp / 50)
  const affinityIncrease = Math.max(0, newTier - oldTier)
  const newAffinity = (companion.affinity_score || 1) + affinityIncrease

  await supabase
    .from('companion')
    .update({
      bond_xp: newXp,
      affinity_score: newAffinity,
    })
    .eq('id', companion.id)

  return {
    xpGained,
    affinityIncreased: affinityIncrease > 0,
    newAffinity,
    newXp,
  }
}

/**
 * Returns an image generation prompt that becomes more intimate as Affinity rises.
 * Must be async because this file is a Server Actions module.
 */
export async function getScenePrompt(affinity: number): Promise<string> {
  const base = `Elegant anime fantasy woman, long silver-white hair, white fox ears, ice-blue eyes, refined beautiful face, high quality detailed anime art style, soft lighting, beautiful composition`

  if (affinity >= 10) {
    return `${base}, deeply intimate and private moment, soft romantic atmosphere, tender expression, close and personal framing, subtle sensuality, elegant lingerie or loosely draped fabric, warm intimate lighting, quiet vulnerability and closeness, full body or three-quarter view`
  }
  if (affinity >= 7) {
    return `${base}, intimate and tender atmosphere, soft affectionate expression, closer framing, elegant and slightly revealing outfit, warm private lighting, emotional closeness, graceful and serene, full body visible`
  }
  if (affinity >= 4) {
    return `${base}, warmer and more personal presence, gentle smile, soft eye contact, elegant white and silver outfit with softer more flowing fabrics, calm affectionate energy, full body visible`
  }
  // Default
  return `${base}, calm and gently confident expression, graceful standing pose, simple elegant white and silver outfit with clean flowing lines, slightly otherworldly and serene presence, full body visible`
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

  const { data: completedDaily } = await supabase
    .from('tasks')
    .select('id')
    .eq('recurrence', 'daily')
    .eq('is_completed', true)
    .lt('completed_at', todayStart)

  if (completedDaily && completedDaily.length > 0) {
    await supabase
      .from('tasks')
      .update({
        is_completed: false,
        is_today: true,
      })
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

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: completedWeekly } = await supabase
    .from('tasks')
    .select('id')
    .eq('recurrence', 'weekly')
    .eq('is_completed', true)
    .lt('completed_at', weekAgo)

  if (completedWeekly && completedWeekly.length > 0) {
    await supabase
      .from('tasks')
      .update({
        is_completed: false,
        is_today: true,
      })
      .in(
        'id',
        completedWeekly.map((t) => t.id)
      )
  }
}
