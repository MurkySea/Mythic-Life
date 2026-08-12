'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

type HabitIntent = 'build' | 'avoid'

type HabitIntentResult =
  | { ok: true; data: { id: string; intent: HabitIntent } }
  | { ok: false; error: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function setHabitIntentAction(
  habitId: string,
  intent: HabitIntent
): Promise<HabitIntentResult> {
  if (!UUID_PATTERN.test(habitId)) return { ok: false, error: 'That habit could not be found.' }
  if (intent !== 'build' && intent !== 'avoid') return { ok: false, error: 'Choose a valid habit direction.' }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { data: activeSession, error: sessionError } = await supabase
    .from('habit_sessions')
    .select('id')
    .eq('habit_id', habitId)
    .eq('user_id', authData.user.id)
    .in('status', ['running', 'paused'])
    .limit(1)
    .maybeSingle()

  if (sessionError) return { ok: false, error: 'The active timer state could not be checked.' }
  if (activeSession) return { ok: false, error: 'Finish the active timer before changing this habit direction.' }

  const { data, error } = await supabase
    .from('habits')
    .update({ intent })
    .eq('id', habitId)
    .eq('user_id', authData.user.id)
    .select('id, intent')
    .maybeSingle()

  if (error || !data) return { ok: false, error: 'That habit direction could not be changed.' }

  revalidatePath('/habits')
  return { ok: true, data: { id: data.id, intent: data.intent as HabitIntent } }
}
