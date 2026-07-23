import { NextResponse } from 'next/server'
import { markConversationRead } from '@/lib/reads'

export const dynamic = 'force-dynamic'

/** Client heartbeat: mark a thread read while the user is viewing it. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const slug = body?.companion_slug as string | undefined
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'Missing companion_slug' }, { status: 400 })
    }
    await markConversationRead(slug)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('read heartbeat', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
