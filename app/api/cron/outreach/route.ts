import { NextResponse } from 'next/server'
import { verifyGithubOutreachToken } from '@/lib/github-actions-oidc'
import { withServiceRoleContext } from '@/utils/supabase/server'
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
export const runtime = 'nodejs'
export const maxDuration = 60

async function isAuthorized(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization')
  const bearer = auth?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (!bearer) return false

  // Preserve the existing manual/Vercel-secret path for diagnostics and rollback.
  const secret = process.env.CRON_SECRET
  if (secret && bearer === secret) return true

  return verifyGithubOutreachToken(bearer)
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return withServiceRoleContext(async () => {
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
        privileged: true,
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
  })
}
