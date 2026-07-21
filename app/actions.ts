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