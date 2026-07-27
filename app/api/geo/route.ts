import { NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { parseGeoEvent } from '@/lib/engines/geo'
import { maybeSchedulePartyUnitReaction } from '@/lib/outreach'

export const dynamic = 'force-dynamic'

/**
 * POST /api/geo
 *
 * Body:
 * {
 *   "place": "home" | "office" | "church" | "gym" | "lake" | "family",
 *   "event": "arrive" | "leave" | "checkin",
 *   "at": "2026-07-26T18:30:00-05:00",   // optional
 *   "source": "shortcut" | "manual" | "browser",
 *   "lat": 29.14, "lng": -98.90          // optional
 * }
 *
 * Auth: Authorization: Bearer <GEO_SECRET or CRON_SECRET>
 */
export async function POST(request: Request) {
  const secret = process.env.GEO_SECRET || process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseGeoEvent(body as Parameters<typeof parseGeoEvent>[0])
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const ev = parsed.event

  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('geo_events').insert({
      place_id: ev.placeId,
      event: ev.event,
      source: ev.source,
      lat: ev.lat ?? null,
      lng: ev.lng ?? null,
      occurred_at: ev.occurredAt,
    })

    if (error) {
      console.error('geo_events insert', error)
      return NextResponse.json(
        {
          error: 'DB write failed',
          detail: error.message,
          hint: 'Run the geo_events SQL from Settings if the table is missing',
        },
        { status: 500 }
      )
    }

    let partyScheduled = false
    try {
      const signal =
        ev.event === 'leave'
          ? ('place_leave' as const)
          : ('place_arrive' as const)
      partyScheduled = await maybeSchedulePartyUnitReaction({
        signal,
        detail: ev.placeId,
        moodInput: { recentTier: 'Neutral' },
      })
    } catch (e) {
      console.error('party unit after geo api', e)
    }

    return NextResponse.json({
      ok: true,
      place: ev.placeId,
      event: ev.event,
      at: ev.occurredAt,
      partyScheduled,
    })
  } catch (e) {
    console.error('geo route', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: 'POST JSON { place, event, at?, source?, lat?, lng? }',
    places: ['home', 'office', 'church', 'gym', 'lake', 'family'],
    events: ['arrive', 'leave', 'checkin'],
  })
}
