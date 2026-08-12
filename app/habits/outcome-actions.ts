'use server'

import { revalidatePath } from 'next/cache'
import { checkAndUnlockCompanions } from '@/app/actions'
import { chicagoDateKey } from '@/lib/habits'
import { createClient } from '@/utils/supabase/server'

type HabitOutcome = 'completed' | 'missed' | 'unlogged'

type OutcomeResult = {
  log_id: string
  current_outcome: 'completed' | 'missed' | null
  is_completed: boolean
  reward_awarded: boolean
  xp_awarded: number
}

type HabitOutcomeActionResult =
  | { ok: true; data: OutcomeResult | null }
  | { ok: false; error: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

export async function setHabitOutcomeAction(
  habitId: string,
  outcome: HabitOutcome
): Promise<HabitOutcomeActionResult> {
  if (!UUID_PATTERN.test(habitId)) {
    return { ok: false, error: 'That habit could not be found.' }
  }
  if (!['completed', 'missed', 'unlogged'].includes(outcome)) {
    return { ok: false, error: 'Choose a valid habit state.' }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' }
  }

  const { data, error } = await supabase.rpc('set_habit_outcome', {
    p_habit_id: habitId,
    p_logged_date: chicagoDateKey(),
    p_outcome: outcome,
  })

  if (error) {
    console.error('setHabitOutcomeAction failed', error)
    if (error.message?.includes('active timer')) {
      return { ok: false, error: 'Finish the active timer before changing this habit outcome.' }
    }
    if (error.message?.includes('Build habits')) {
      return { ok: false, error: 'Build habits are completed through their normal tracking action.' }
    }
    return { ok: false, error: 'That habit state could not be changed.' }
  }

  const result = firstRow(data as OutcomeResult[] | OutcomeResult | null)
  if (result?.reward_awarded && result.xp_awarded > 0) {
    await checkAndUnlockCompanions().catch((unlockError) => {
      console.error('habit companion unlock check failed', unlockError)
    })
  }

  revalidatePath('/habits')
  if (result?.reward_awarded) {
    revalidatePath('/')
    revalidatePath('/standing')
    revalidatePath('/skills')
    revalidatePath('/companions')
  }

  return { ok: true, data: result }
}
