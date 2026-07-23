import { NextResponse } from 'next/server'
import {
  flushDueOutreach,
  maybeScheduleDayMoments,
  maybeScheduleTimeAnchors,
  maybeScheduleWanderingCheckIn,
  maybeScheduleMissingYou,
  maybeScheduleShareMoment,
} from '@/lib/outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const timeAnchors = await maybeScheduleTimeAnchors()
    const wandering = await maybeScheduleWanderingCheckIn()
    const missingYou = await maybeScheduleMissingYou()
    const shareMoment = await maybeScheduleShareMoment()
    await maybeScheduleDayMoments()
    const result = await flushDueOutreach()
    return NextResponse.json({
      ok: true,
      timeAnchorsScheduled: timeAnchors,
      wanderingScheduled: wandering,
      missingYouScheduled: missingYou,
      shareMomentScheduled: shareMoment,
      ...result,
    })
  } catch (e) {
    console.error('cron outreach', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
