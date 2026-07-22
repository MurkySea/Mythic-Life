'use server'

import { createClient } from '@/utils/supabase/server'

// ─── Dialogue Style by Affinity ───────────────────────────────────────────────

function getDialogueStyle(affinity: number): string {
  if (affinity >= 20) {
    return `You share an intense, private, and deeply sensual bond with the user. Speak with quiet heat, soft desire, and intimate tenderness. Your words can be openly affectionate, slightly teasing, and carry clear romantic and sensual undertones while remaining elegant and never vulgar.`
  }
  if (affinity >= 16) {
    return `You feel a strong, heated intimacy with the user. Speak with warmth, soft desire, and emotional closeness. Gentle teasing, personal affection, and subtle sensuality are natural. Stay elegant and composed even when the mood turns more intimate.`
  }
  if (affinity >= 12) {
    return `You share a deep, private intimacy with the user. Speak with quiet tenderness, emotional closeness, and soft romantic undertones. Your words can be personal, vulnerable, and gently sensual while remaining elegant and never crude.`
  }
  if (affinity >= 9) {
    return `You feel a strong intimacy with the user. Speak warmly and tenderly. Soft affection and emotional closeness come naturally. You can be gently romantic and let your care show openly.`
  }
  if (affinity >= 6) {
    return `You have grown close to the user. Speak with genuine warmth, personal care, and soft affection while remaining elegant and composed.`
  }
  if (affinity >= 3) {
    return `You are becoming familiar with the user. Speak with quiet warmth and supportive presence. You are kind, attentive, and gently encouraging.`
  }
  return `You are a calm, warm, quietly strong companion. Speak with kindness, clarity, and quiet respect. You are supportive but still somewhat reserved.`
}

// ─── Scene Prompt by Affinity ─────────────────────────────────────────────────
// Each tier is written as a distinctly different scene so the image model has clear signal.

export async function getScenePrompt(affinity: number): Promise<string> {
  // Highest tier — borderline ecchi
  if (affinity >= 20) {
    return `Borderline ecchi anime illustration of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, refined beautiful face with flushed cheeks and slightly parted lips, soft sensual expression, wearing elegant revealing lingerie or loosely draped sheer white fabric that clings to her body, intimate bedroom or private chamber setting, warm golden intimate lighting, close three-quarter view, clear soft sensuality, high quality detailed anime art, tasteful but explicitly intimate`
  }

  // Heated intimacy
  if (affinity >= 16) {
    return `Intimate anime illustration of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, soft desirous expression, wearing elegant lingerie or a partially open silver-white outfit that reveals soft skin, warm private lighting, close personal framing, romantic and softly sensual atmosphere, full body or three-quarter view, high quality detailed anime art`
  }

  // Deeply intimate
  if (affinity >= 12) {
    return `Intimate anime portrait of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, tender vulnerable expression, wearing elegant white lingerie or loosely draped soft fabric, warm intimate lighting, close framing, quiet romantic atmosphere, full body or three-quarter view, high quality detailed anime art`
  }

  // Close & tender
  if (affinity >= 9) {
    return `Warm anime illustration of an elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, soft affectionate smile, wearing a slightly revealing elegant white and silver outfit with flowing fabric, gentle private lighting, closer framing, calm romantic atmosphere, full body visible, high quality detailed anime art`
  }

  // Warming bond
  if (affinity >= 6) {
    return `Elegant anime illustration of a silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, gentle warm smile, wearing a soft elegant white and silver dress with flowing lines, soft natural lighting, graceful standing pose, calm affectionate presence, full body visible, high quality detailed anime art`
  }

  // Growing familiar
  if (affinity >= 3) {
    return `Elegant anime illustration of a silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, calm confident expression, wearing a simple elegant white and silver outfit, soft lighting, graceful standing pose, serene otherworldly presence, full body visible, high quality detailed anime art`
  }

  // Default / low
  return `Elegant anime illustration of a silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes, reserved calm expression, wearing a simple clean white and silver outfit with flowing lines, soft lighting, graceful standing pose, distant serene presence, full body visible, high quality detailed anime art`
}

// ─── Seraphine Response ───────────────────────────────────────────────────────

export async function generateSeraphineResponse(taskTitle: string, domain: string = '') {
  const supabase = await createClient()

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
        model: 'grok-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85,
        max_tokens: 300,
      }),
    })

    const data = await response.json()
    const message =
      data.choices?.[0]?.message?.content ||
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

// ─── Bond / Affinity Progression ──────────────────────────────────────────────

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

  // Affinity increases every 35 Bond XP
  const oldTier = Math.floor(currentXp / 35)
  const newTier = Math.floor(newXp / 35)
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

// ─── Local Midnight (America/Chicago) ─────────────────────────────────────────

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

// ─── Recurring Tasks ──────────────────────────────────────────────────────────

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
      .update({ is_completed: false, is_today: true })
      .in('id', completedDaily.map((t) => t.id))
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
      .update({ is_completed: false, is_today: true })
      .in('id', completedWeekly.map((t) => t.id))
  }
}
