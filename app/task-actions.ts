'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function refreshTaskSurfaces() {
  revalidatePath('/')
  revalidatePath('/today')
  revalidatePath('/tasks')
  revalidatePath('/mother-list')
  revalidatePath('/task-generator')
}

export async function deleteTaskAction(taskId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_PATTERN.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) {
    console.error('deleteTaskAction failed', error)
    return { ok: false, error: 'The task could not be deleted.' }
  }

  refreshTaskSurfaces()
  return { ok: true }
}

export async function updateTaskAction(taskId: string, formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_PATTERN.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { ok: false, error: 'Your session has expired. Please sign in again.' }

  const title = String(formData.get('title') || '').trim().slice(0, 160)
  const notes = String(formData.get('notes') || '').trim().slice(0, 1000)
  const domainsRaw = formData.getAll('domains').map(String).filter(Boolean)
  const recurrence = String(formData.get('recurrence') || 'none')
  const weekdaysRaw = formData.getAll('weekdays').map(String).filter(Boolean)
  const anchorRaw = String(formData.get('anchor_time') || '').trim()
  const anchorTime = /^\d{1,2}:\d{2}$/.test(anchorRaw) ? anchorRaw : null
  const addToToday = formData.get('add_to_today') === 'on'

  if (!title) return { ok: false, error: 'Title is required.' }
  if (!['none', 'daily', 'weekly'].includes(recurrence)) return { ok: false, error: 'Choose a valid repeat schedule.' }

  const weekdays = recurrence === 'weekly' && weekdaysRaw.length > 0 ? weekdaysRaw.join(',') : null
  let isToday = addToToday
  if (recurrence === 'daily') isToday = true
  else if (recurrence === 'weekly' && weekdays) {
    const todayKey = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short' })
      .format(new Date()).toLowerCase().slice(0, 3)
    isToday = weekdays.split(',').includes(todayKey) || addToToday
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({
      title,
      notes: notes || null,
      domain: domainsRaw[0] || null,
      domains: domainsRaw.length > 0 ? domainsRaw.join(',') : null,
      recurrence,
      weekdays,
      anchor_time: anchorTime,
      is_today: isToday,
    })
    .eq('id', taskId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('updateTaskAction failed', error)
    return { ok: false, error: 'The task could not be updated.' }
  }

  refreshTaskSurfaces()
  return { ok: true }
}
