import { NextResponse } from 'next/server'
import {
  flushDueOutreach,
  maybeScheduleDayMoments,
  maybeScheduleTimeAnchors,
  maybeScheduleWanderingCheckIn,
  maybeScheduleMissingYou,
  maybeScheduleShareMoment,
  maybeSchedulePartyUnitFromRecentGeo,
  maybeScheduleCuriosityInitiation,
} from '@/lib/outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const timeAnchors = await maybeScheduleTimeAnchors()
    const wandering = await maybeScheduleWanderingCheckIn()
    // Heavy emotional tones compete via shared daily cap (one of curiosity / missing_you / soft_love)
    const curiosity = await maybeScheduleCuriosityInitiation()
    const missingYou = await maybeScheduleMissingYou()
    const shareMoment = await maybeScheduleShareMoment()
    const partyGeo = await maybeSchedulePartyUnitFromRecentGeo()
    await maybeScheduleDayMoments()
    const result = await flushDueOutreach()
    return NextResponse.json({
      ok: true,
      timeAnchorsScheduled: timeAnchors,
      wanderingScheduled: wandering,
      curiosityScheduled: curiosity,
      missingYouScheduled: missingYou,
      shareMomentScheduled: shareMoment,
      partyUnitFromGeo: partyGeo,
      ...result,
    })
  } catch (e) {
    console.error('cron outreach', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
