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
 * Ensures recurring tasks (daily / weekly) are correctly set for the current day.
 * - Daily: incomplete ones always appear on Today. Completed ones from previous days are reset.
 * - Weekly: completed ones older than 7 days are reset and put back on Today.
 * Call this at the start of the Today page.
 */
export async function ensureRecurringTasks() {
  const supabase = await createClient()
  const now = new Date()

  // Start of today in UTC (consistent with typical Supabase timestamptz)
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString()

  // ── Daily ────────────────────────────────────────────────
  // Reset any daily tasks that were completed before today
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
