'use server'

import { revalidatePath } from 'next/cache'
import { checkAndUnlockCompanions } from '@/app/actions'
import {
  HABIT_ICON_NAMES,
  HABIT_SUGGESTIONS,
  IMPULSE_CATEGORIES,
  chicagoDateKey,
  isHabitFrequency,
  isHabitIcon,
  isImpulseCategory,
  isSkillKey,
  isTrackingType,
  type HabitSessionRow,
  type ImpulseCategory,
} from '@/lib/habits'
import { createClient } from '@/utils/supabase/server'

type HabitActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string }

type ProgressResult = {
  log_id: string
  current_value: number
  current_duration_seconds: number
  is_completed: boolean
  reward_awarded: boolean
  xp_awarded: number
}

type FinishResult = {
  finished_session_id: string
  final_duration_seconds: number
  log_id: string
  daily_duration_seconds: number
  is_completed: boolean
  reward_awarded: boolean
  xp_awarded: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

async function authenticatedContext() {
  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.getUser()
  if (error || !authData.user) return null
  return { supabase, user: authData.user }
}

function refreshHabitSurfaces(rewarded = false) {
  revalidatePath('/habits')
  if (rewarded) {
    revalidatePath('/')
    revalidatePath('/standing')
    revalidatePath('/skills')
    revalidatePath('/companions')
  }
}

function safeNumber(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDays(formData: FormData): number[] {
  const values = formData
    .getAll('days')
    .flatMap((value) => String(value).split(','))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
  return [...new Set(values)].sort((a, b) => a - b)
}

export async function saveHabitAction(
  formData: FormData
): Promise<HabitActionResult<{ id: string }>> {
  const context = await authenticatedContext()
  if (!context) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const id = String(formData.get('id') || '').trim()
  const title = String(formData.get('title') || '').trim().slice(0, 100)
  const description = String(formData.get('description') || '').trim().slice(0, 500)
  const trackingType = String(formData.get('tracking_type') || 'check')
  const frequency = String(formData.get('frequency') || 'daily')
  const icon = String(formData.get('icon') || HABIT_ICON_NAMES[0])
  const skillValue = String(formData.get('skill_key') || '')
  const targetUnit = String(formData.get('target_unit') || '').trim().slice(0, 40)
  const days = parseDays(formData)
  const xpReward = Math.max(0, Math.min(100, Math.floor(safeNumber(formData.get('xp_reward')))))

  if (!title) return { ok: false, error: 'Name the training before saving it.' }
  if (id && !isUuid(id)) return { ok: false, error: 'That habit could not be found.' }
  if (!isTrackingType(trackingType)) return { ok: false, error: 'Choose a valid tracking type.' }
  if (!isHabitFrequency(frequency)) return { ok: false, error: 'Choose a valid schedule.' }
  if (!isHabitIcon(icon)) return { ok: false, error: 'Choose a valid sigil.' }
  if (skillValue && !isSkillKey(skillValue)) return { ok: false, error: 'Choose a valid skill.' }
  if (frequency === 'specific_days' && days.length === 0) {
    return { ok: false, error: 'Choose at least one training day.' }
  }

  const targetValue = trackingType === 'counter'
    ? Math.max(1, Math.min(1_000_000, safeNumber(formData.get('target_value'), 1)))
    : null
  const targetSeconds = trackingType === 'timer'
    ? Math.max(1, Math.min(604_800, Math.floor(safeNumber(formData.get('target_seconds'), 120))))
    : null
  const isImpulseResistance = trackingType === 'counter'
    && String(formData.get('is_impulse_resistance') || '') === 'true'

  const row = {
    user_id: context.user.id,
    title,
    description: description || null,
    tracking_type: trackingType,
    target_value: targetValue,
    target_unit: trackingType === 'counter' ? targetUnit || 'repetitions' : null,
    target_seconds: targetSeconds,
    frequency,
    days_of_week: frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : days,
    xp_reward: xpReward,
    skill_key: skillValue || null,
    icon,
    is_impulse_resistance: isImpulseResistance,
    is_active: String(formData.get('is_active') || 'true') === 'true',
  }

  if (id) {
    const { data: activeSession, error: sessionError } = await context.supabase
      .from('habit_sessions')
      .select('id')
      .eq('habit_id', id)
      .eq('user_id', context.user.id)
      .in('status', ['running', 'paused'])
      .limit(1)
      .maybeSingle()
    if (sessionError) return { ok: false, error: 'The active timer state could not be checked.' }
    if (activeSession) return { ok: false, error: 'Finish the active timer before editing this habit.' }

    const { data, error } = await context.supabase
      .from('habits')
      .update(row)
      .eq('id', id)
      .eq('user_id', context.user.id)
      .select('id')
      .maybeSingle()
    if (error || !data) {
      console.error('saveHabitAction: update failed', error)
      return { ok: false, error: 'The training record could not be updated.' }
    }
    refreshHabitSurfaces()
    return { ok: true, data: { id: data.id }, message: 'Training updated.' }
  }

  const { data, error } = await context.supabase
    .from('habits')
    .insert(row)
    .select('id')
    .single()
  if (error || !data) {
    console.error('saveHabitAction: insert failed', error)
    return { ok: false, error: 'The training record could not be created.' }
  }
  refreshHabitSurfaces()
  return { ok: true, data: { id: data.id }, message: 'Training added.' }
}

export async function addSuggestedHabitAction(
  slug: string
): Promise<HabitActionResult<{ id: string }>> {
  const suggestion = HABIT_SUGGESTIONS.find((item) => item.slug === slug)
  if (!suggestion) return { ok: false, error: 'That suggestion is not available.' }
  const context = await authenticatedContext()
  if (!context) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { data, error } = await context.supabase
    .from('habits')
    .insert({
      user_id: context.user.id,
      title: suggestion.title,
      tracking_type: suggestion.trackingType,
      target_value: suggestion.targetValue ?? null,
      target_unit: suggestion.targetUnit ?? null,
      target_seconds: suggestion.targetSeconds ?? null,
      frequency: 'daily',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      xp_reward: suggestion.xpReward,
      skill_key: suggestion.skillKey ?? null,
      icon: suggestion.icon,
      is_impulse_resistance: suggestion.impulse ?? false,
      is_active: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('addSuggestedHabitAction failed', error)
    return { ok: false, error: 'The suggested training could not be added.' }
  }
  refreshHabitSurfaces()
  return { ok: true, data: { id: data.id }, message: `${suggestion.title} added.` }
}

export async function setHabitActiveAction(
  habitId: string,
  isActive: boolean
): Promise<HabitActionResult<{ id: string; isActive: boolean }>> {
  if (!isUuid(habitId)) return { ok: false, error: 'That habit could not be found.' }
  const context = await authenticatedContext()
  if (!context) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  if (!isActive) {
    const { data: activeSession, error: sessionError } = await context.supabase
      .from('habit_sessions')
      .select('id')
      .eq('habit_id', habitId)
      .eq('user_id', context.user.id)
      .in('status', ['running', 'paused'])
      .limit(1)
      .maybeSingle()
    if (sessionError) return { ok: false, error: 'The active timer state could not be checked.' }
    if (activeSession) return { ok: false, error: 'Finish the active timer before archiving this habit.' }
  }

  const { data, error } = await context.supabase
    .from('habits')
    .update({ is_active: isActive })
    .eq('id', habitId)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle()
  if (error || !data) return { ok: false, error: 'The training state could not be changed.' }
  refreshHabitSurfaces()
  return { ok: true, data: { id: data.id, isActive } }
}

export async function recordHabitProgressAction(
  habitId: string,
  requestId: string,
  impulseCategory: ImpulseCategory | null = null
): Promise<HabitActionResult<ProgressResult>> {
  if (!isUuid(habitId) || !isUuid(requestId)) {
    return { ok: false, error: 'That training request was not valid.' }
  }
  if (impulseCategory && !isImpulseCategory(impulseCategory)) {
    return { ok: false, error: 'Choose a valid category.' }
  }

  const context = await authenticatedContext()
  if (!context) return { ok: false, error: 'Your session has expired. Please sign in again.' }
  const { data, error } = await context.supabase.rpc('record_habit_progress', {
    p_habit_id: habitId,
    p_logged_date: chicagoDateKey(),
    p_request_id: requestId,
    p_impulse_category: impulseCategory,
  })
  const result = firstRow(data as ProgressResult[] | ProgressResult | null)
  if (error || !result) {
    console.error('recordHabitProgressAction failed', error)
    return { ok: false, error: 'That repetition could not be recorded.' }
  }

  if (result.reward_awarded && result.xp_awarded > 0) {
    await checkAndUnlockCompanions().catch((unlockError) => {
      console.error('habit companion unlock check failed', unlockError)
    })
  }
  refreshHabitSurfaces(result.reward_awarded)
  return { ok: true, data: result }
}

export async function startHabitTimerAction(
  habitId: string
): Promise<HabitActionResult<HabitSessionRow>> {
  if (!isUuid(habitId)) return { ok: false, error: 'That timer could not be found.' }
  const context = await authenticatedContext()
  if (!context) return { ok: false, error: 'Your session has expired. Please sign in again.' }
  const { data, error } = await context.supabase.rpc('start_habit_session', {
    p_habit_id: habitId,
    p_logged_date: chicagoDateKey(),
  })
  const session = firstRow(data as HabitSessionRow[] | HabitSessionRow | null)
  if (error || !session) {
    console.error('startHabitTimerAction failed', error)
    return { ok: false, error: 'The timer could not be started.' }
  }
  refreshHabitSurfaces()
  return { ok: true, data: session }
}

export async function pauseHabitTimerAction(
  sessionId: string
): Promise<HabitActionResult<HabitSessionRow>> {
  return mutateTimerSession('pause_habit_session', sessionId)
}

export async function resumeHabitTimerAction(
  sessionId: string
): Promise<HabitActionResult<HabitSessionRow>> {
  return mutateTimerSession('resume_habit_session', sessionId)
}

async function mutateTimerSession(
  rpcName: 'pause_habit_session' | 'resume_habit_session',
  sessionId: string
): Promise<HabitActionResult<HabitSessionRow>> {
  if (!isUuid(sessionId)) return { ok: false, error: 'That timer session could not be found.' }
  const context = await authenticatedContext()
  if (!context) return { ok: false, error: 'Your session has expired. Please sign in again.' }
  const { data, error } = await context.supabase.rpc(rpcName, { p_session_id: sessionId })
  const session = firstRow(data as HabitSessionRow[] | HabitSessionRow | null)
  if (error || !session) {
    console.error(`${rpcName} failed`, error)
    return { ok: false, error: 'The timer state could not be changed.' }
  }
  refreshHabitSurfaces()
  return { ok: true, data: session }
}

export async function finishHabitTimerAction(
  sessionId: string,
  requestId: string
): Promise<HabitActionResult<FinishResult>> {
  if (!isUuid(sessionId) || !isUuid(requestId)) {
    return { ok: false, error: 'That timer request was not valid.' }
  }
  const context = await authenticatedContext()
  if (!context) return { ok: false, error: 'Your session has expired. Please sign in again.' }
  const { data, error } = await context.supabase.rpc('finish_habit_session', {
    p_session_id: sessionId,
    p_request_id: requestId,
  })
  const result = firstRow(data as FinishResult[] | FinishResult | null)
  if (error || !result) {
    console.error('finishHabitTimerAction failed', error)
    return { ok: false, error: 'The timer could not be finished.' }
  }

  if (result.reward_awarded && result.xp_awarded > 0) {
    await checkAndUnlockCompanions().catch((unlockError) => {
      console.error('habit companion unlock check failed', unlockError)
    })
  }
  refreshHabitSurfaces(result.reward_awarded)
  return { ok: true, data: result }
}

export async function recordImpulseAction(
  habitId: string,
  requestId: string,
  category: string | null
): Promise<HabitActionResult<ProgressResult>> {
  if (category && !(IMPULSE_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: 'Choose a valid category.' }
  }
  return recordHabitProgressAction(habitId, requestId, category as ImpulseCategory | null)
}
