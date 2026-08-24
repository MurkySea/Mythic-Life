import { NextResponse } from 'next/server'
import { sendPushToAll } from '@/lib/push'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendPushToAll({
    title: 'Elowen',
    body: 'Push test from Mythic Life — if you can read this, the notification path is healthy.',
    url: '/messages',
    tag: 'mythic-test-push',
  })

  return NextResponse.json({
    ok: result.sent > 0,
    ...result,
  })
}
