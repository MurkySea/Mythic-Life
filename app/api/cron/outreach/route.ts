import { NextResponse } from 'next/server'
import { flushDueOutreach, maybeScheduleDayMoments } from '@/lib/outreach'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Vercel Cron: flush due companion outreach + evening quiet/productive moments.
 * Secure with CRON_SECRET header when set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    await maybeScheduleDayMoments()
    const result = await flushDueOutreach()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('cron outreach', e)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
