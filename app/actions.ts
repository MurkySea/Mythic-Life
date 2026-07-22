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
 * Returns the start of the current local day (midnight) in America/Chicago
 * as an ISO string. This is used so daily tasks reset at the user's local midnight
 * instead of UTC midnight.
 */
function getLocalDayStartISO(): string {
  const timeZone = 'America/Chicago' // Central Time (Texas)

  // Get the current date parts in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(new Date())
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value

  // Construct midnight in that timezone by creating a date string and letting
  // the engine interpret it. We then convert to a proper UTC ISO string.
  // Format: YYYY-MM-DDT00:00:00 in the local zone → correct UTC instant.
  const localMidnight = new Date(`${year}-${month}-${day}T00:00:00`)

  // Adjust for the timezone offset of America/Chicago at that moment
  // A cleaner way: use the fact that we want the UTC time that corresponds
  // to midnight in Chicago.
  const chicagoOffsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })

  // Simpler reliable approach for our purpose:
  // Create a date at UTC midnight of the Chicago calendar day, then subtract the offset.
  // For most use-cases the following is accurate enough and avoids DST edge cases poorly:
  const approx = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))

  // Better: use a library-free way that works with DST
  // We format the current time in Chicago and rebuild.
  const nowInChicago = new Date().toLocaleString('en-US', { timeZone })
  const chicagoDate = new Date(nowInChicago)

  // Final clean method:
  // Get YYYY-MM-DD in Chicago, then create a Date representing midnight UTC of that day,
  // then we will compare against completed_at which is also UTC.
  // Because completed_at is stored in UTC, comparing against the UTC instant of
  // Chicago midnight is correct.
  const chicagoYmd = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  // chicagoYmd is "YYYY-MM-DD"
  // Now get the UTC timestamp that corresponds to 00:00:00 in America/Chicago on that day
  // We can do this by creating a date and adjusting.
  const testDate = new Date(`${chicagoYmd}T12:00:00Z`) // noon UTC on that calendar day
  const chicagoTimeAtNoonUTC = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).format(testDate)

  const hourInChicago = parseInt(chicagoTimeAtNoonUTC, 10)
  // The offset in hours from UTC at that moment
  const offsetHours = 12 - hourInChicago

  const midnightUTC = new Date(`${chicagoYmd}T00:00:00Z`)
  midnightUTC.setUTCHours(midnightUTC.getUTCHours() + offsetHours)

  return midnightUTC.toISOString()
}

/**
 * Ensures recurring tasks (daily / weekly) are correctly set for the current day.
 * Day boundary is local midnight in America/Chicago (Central Time).
 * - Daily: incomplete ones always appear on Today. Completed ones from previous local days are reset.
 * - Weekly: completed ones older than 7 days are reset and put back on Today.
 */
export async function ensureRecurringTasks() {
  const supabase = await createClient()
  const now = new Date()

  // Start of today at local midnight (America/Chicago)
  const todayStart = getLocalDayStartISO()

  // ── Daily ────────────────────────────────────────────────
  // Reset any daily tasks that were completed before today (local midnight)
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

  // Make sure every incomplete daily task is on Today
  await supabase
    .from('tasks')
    .update({ is_today: true })
    .eq('recurrence', 'daily')
    .eq('is_completed', false)

  // ── Weekly ───────────────────────────────────────────────
  // Reset weekly tasks completed more than 7 days ago
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
