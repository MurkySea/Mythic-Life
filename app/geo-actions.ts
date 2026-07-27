'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { parseGeoEvent } from '@/lib/engines/geo'
import type { PlaceId } from '@/lib/engines/places'
import { maybeSchedulePartyUnitReaction } from '@/lib/outreach'

export async function actionGeoCheckIn(formData: FormData) {
  const place = String(formData.get('place') || '')
  const event = String(formData.get('event') || 'checkin')

  const parsed = parseGeoEvent({
    place,
    event,
    source: 'manual',
  })

  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error }
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
    return {
      ok: false as const,
      error: error.message.includes('relation')
        ? 'geo_events table missing — run SQL in Settings'
        : error.message,
    }
  }

  // Party notices life signal (~35% via maybeSchedule; force false)
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
  return { ok: true as const, place: ev.placeId as PlaceId, event: ev.event }
}
