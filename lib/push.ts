import webpush from 'web-push'
import { createServiceClient } from '@/utils/supabase/server'

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

function configureWebPush(): { ok: true } | { ok: false; reason: 'missing-vapid' } {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:mark@mythic-life.app'

  if (!publicKey || !privateKey) {
    console.error('push unavailable: missing VAPID configuration')
    return { ok: false, reason: 'missing-vapid' }
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  return { ok: true }
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

export type PushSendResult = {
  sent: number
  failed: number
  reason?:
    | 'missing-vapid'
    | 'subscription-query-failed'
    | 'no-subscriptions'
    | 'delivery-failed'
}

/**
 * Fan-out notification to every stored subscription.
 *
 * This is a privileged server operation: cron jobs do not have a user session,
 * so use the service-role client rather than an RLS/cookie-bound client.
 */
export async function sendPushToAll(payload: PushPayload): Promise<PushSendResult> {
  const configured = configureWebPush()
  if (!configured.ok) {
    return { sent: 0, failed: 0, reason: configured.reason }
  }

  const supabase = createServiceClient()
  const { data: rows, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (error) {
    console.error('push subscription query failed', error)
    return { sent: 0, failed: 0, reason: 'subscription-query-failed' }
  }

  if (!rows?.length) {
    console.warn('push skipped: no stored subscriptions')
    return { sent: 0, failed: 0, reason: 'no-subscriptions' }
  }

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

        // Gone / expired subscription — remove it so the device can re-register cleanly.
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
        } else {
          console.error('push send failed', status, err)
        }
      }
    })
  )

  if (failed > 0 && sent === 0) {
    return { sent, failed, reason: 'delivery-failed' }
  }

  return { sent, failed }
}
