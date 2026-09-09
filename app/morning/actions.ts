'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import {
  buildMorningCompanionSeed,
  buildMorningUserMessage,
  chicagoDateKey,
  latestCampfireDigest,
  type MorningRitualInput,
} from '@/lib/daily-ritual'

function clean(value: FormDataEntryValue | null, max = 600): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export async function submitMorningRitual(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  const user = authData.user
  if (authError || !user) throw new Error('You must be signed in to begin the day.')

  const today = chicagoDateKey()
  const companionSlug = clean(formData.get('companion_slug'), 80) || 'seraphine'
  const intention = clean(formData.get('morning_intention'))
  const resistance = clean(formData.get('morning_resistance'))
  const identity = clean(formData.get('morning_identity'))
  const requestedTaskId = clean(formData.get('main_quest_task_id'), 80)

  if (!intention || !resistance || !identity) {
    throw new Error('Complete the three morning prompts before beginning the day.')
  }

  const { data: existing } = await supabase
    .from('daily_rituals')
    .select('id, morning_completed_at')
    .eq('ritual_date', today)
    .maybeSingle()

  if (existing?.morning_completed_at) return

  let mainQuestTaskId: string | null = null
  let mainQuestTitle: string | null = null
  if (requestedTaskId) {
    const { data: task } = await supabase
      .from('tasks')
      .select('id, title, is_completed')
      .eq('id', requestedTaskId)
      .maybeSingle()

    if (task && !task.is_completed) {
      mainQuestTaskId = task.id
      mainQuestTitle = clean(task.title, 220)
    }
  }

  const { data: systemMessages } = await supabase
    .from('messages')
    .select('content, created_at')
    .eq('role', 'system')
    .order('created_at', { ascending: false })
    .limit(100)

  const previousCampfire = latestCampfireDigest(systemMessages || [], today)
  const input: MorningRitualInput = {
    mainQuestTitle,
    intention,
    resistance,
    identity,
  }
  const completedAt = new Date().toISOString()

  const { error: ritualError } = await supabase.from('daily_rituals').upsert(
    {
      user_id: user.id,
      ritual_date: today,
      morning_companion_slug: companionSlug,
      main_quest_task_id: mainQuestTaskId,
      main_quest_title: mainQuestTitle,
      morning_intention: intention,
      morning_resistance: resistance,
      morning_identity: identity,
      morning_completed_at: completedAt,
      updated_at: completedAt,
    },
    { onConflict: 'user_id,ritual_date' }
  )

  if (ritualError) throw new Error(`Morning check-in could not be saved: ${ritualError.message}`)

  const userMessage = buildMorningUserMessage(input)
  const { error: messageError } = await supabase.from('messages').insert({
    role: 'user',
    content: userMessage,
    companion_slug: companionSlug,
  })

  if (messageError) console.error('morning ritual message insert failed', messageError)

  try {
    const { generateCompanionResponse } = await import('../actions')
    const reply = await generateCompanionResponse(
      buildMorningCompanionSeed(input, previousCampfire),
      'morning-ritual',
      {
        force: true,
        isConversation: true,
        companionSlug,
      }
    )

    if (reply) {
      const { error: responseError } = await supabase
        .from('daily_rituals')
        .update({ morning_response: reply, updated_at: new Date().toISOString() })
        .eq('ritual_date', today)

      if (responseError) console.error('morning ritual response save failed', responseError)
    }
  } catch (error) {
    console.error('morning companion response failed', error)
  }

  revalidatePath('/morning')
  revalidatePath('/')
  revalidatePath('/messages')
  revalidatePath('/camp')
}
