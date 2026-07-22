import webpush from 'web-push'
import { createClient } from '@/utils/supabase/server'

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:mark@mythic-life.app'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

/** Fan-out notification to every stored subscription. Safe no-op if unset. */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0 }
  }

  const supabase = await createClient()
  const { data: rows } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth')

  if (!rows?.length) return { sent: 0, failed: 0 }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/messages',
    tag: payload.tag || 'mythic-companion',
  })

  let sent = 0
  let failed = 0

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body
        )
        sent++
      } catch (err: unknown) {
        failed++
        const status = (err as { statusCode?: number })?.statusCode
        // Gone / expired subscription — drop it
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
        } else {
          console.error('push send failed', status, err)
        }
      }
    })
  )

  return { sent, failed }
}
