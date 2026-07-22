'use server'

import { createClient } from '@/utils/supabase/server'

export async function generateSeraphineResponse(taskTitle: string, domain: string = '') {
  const supabase = await createClient()

  const prompt = `You are Seraphine, a calm, warm, quietly strong silver foxkin companion who values faith, discipline, and integrity. 
You speak with kindness and clarity, never nagging but always honest.
The user just completed the task: "${taskTitle}"${domain ? ` (Domain: ${domain})` : ''}.

Write a short, personal, encouraging reaction (2-4 sentences). 
Make it feel like a real conversation.`

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
        temperature: 0.8,
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
 * Returns the amount of XP gained and whether Affinity increased.
 */
export async function awardBondProgress(domain: string = '') {
  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('id, bond_xp, affinity_score')
    .single()

  if (!companion) return { xpGained: 0, affinityIncreased: false }

  // Base XP + small bonus if the task has a domain
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
 * Returns the start of the current local day (midnight) in America/Chicago
 * as an ISO string. This is used so daily tasks reset at the user's local midnight
 * instead of UTC midnight.
 */
function getLocalDayStartISO(): string {
  const timeZone = 'America/Chicago' // Central Time (Texas)

  const chicagoYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  // Find the UTC instant that corresponds to midnight in Chicago on this calendar day
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

/**
 * Ensures recurring tasks (daily / weekly) are correctly set for the current day.
 * Day boundary is local midnight in America/Chicago (Central Time).
 */
export async function ensureRecurringTasks() {
  const supabase = await createClient()
  const now = new Date()

  const todayStart = getLocalDayStartISO()

  // Daily: reset completed tasks from previous local days
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

  // Ensure incomplete daily tasks appear on Today
  await supabase
    .from('tasks')
    .update({ is_today: true })
    .eq('recurrence', 'daily')
    .eq('is_completed', false)

  // Weekly: reset if completed more than 7 days ago
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
