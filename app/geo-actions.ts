'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { parseGeoEvent } from '@/lib/engines/geo'
import { maybeSchedulePartyUnitReaction } from '@/lib/outreach'

export async function actionGeoCheckIn(formData: FormData): Promise<void> {
  const place = String(formData.get('place') || '')
  const event = String(formData.get('event') || 'checkin')

  const parsed = parseGeoEvent({
    place,
    event,
    source: 'manual',
  })

  if (!parsed.ok) {
    console.error('actionGeoCheckIn parse', parsed.error)
    return
  }

  const ev = parsed.event
  const supabase = await createClient()

  const { error } = await supabase.from('geo_events').insert({
    place_id: ev.placeId,
    event: ev.event,
    source: ev.source,
    occurred_at: ev.occurredAt,
  })

  if (error) {
    console.error('actionGeoCheckIn', error)
    return
  }

  // Party notices life signal
  try {
    const signal =
      ev.event === 'leave'
        ? ('place_leave' as const)
        : ('place_arrive' as const)
    await maybeSchedulePartyUnitReaction({
      signal,
      detail: ev.placeId,
      moodInput: { recentTier: 'Neutral' },
    })
  } catch (e) {
    console.error('party unit after geo', e)
  }

  revalidatePath('/places')
  revalidatePath('/')
}
