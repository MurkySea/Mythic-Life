'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function subscriptionUsesKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options.applicationServerKey
  if (!current) return false

  const expected = urlBase64ToUint8Array(publicKey)
  const actual = new Uint8Array(current)
  if (actual.length !== expected.length) return false

  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) return false
  }

  return true
}

async function saveSubscription(subscription: PushSubscription) {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.hint || data.error || 'Could not save subscription')
  }
}

type Status = 'loading' | 'unsupported' | 'need-keys' | 'off' | 'on' | 'denied' | 'error'

export default function PushEnable() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const [status, setStatus] = useState<Status>(() => {
    if (typeof window === 'undefined') return 'loading'
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return 'unsupported'
    }
    if (!publicKey) return 'need-keys'
    if (Notification.permission === 'denied') return 'denied'
    return 'loading'
  })
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window) ||
      !publicKey ||
      Notification.permission === 'denied'
    ) {
      return
    }

    let cancelled = false

    async function inspectAndRepair() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()

        if (cancelled) return

        if (!sub) {
          setStatus('off')
          return
        }

        // A subscription is bound to the VAPID public key that created it.
        // If keys were rotated, the old subscription cannot receive new pushes.
        if (!subscriptionUsesKey(sub, publicKey)) {
          setStatus('off')
          setMessage('Notification key changed. Tap enable to reconnect this device.')
          return
        }

        // Re-post the local subscription every time Settings opens. This repairs the
        // common case where the browser still has a subscription but the server row
        // was pruned, reset, or lost.
        await saveSubscription(sub)
        if (!cancelled) {
          setStatus('on')
          setMessage('')
        }
      } catch (e) {
        console.error('push inspection failed', e)
        if (!cancelled) {
          setStatus('error')
          setMessage(e instanceof Error ? e.message : 'Could not verify notification setup.')
        }
      }
    }

    inspectAndRepair()

    return () => {
      cancelled = true
    }
  }, [publicKey])

  async function enable() {
    setMessage('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      let sub = await reg.pushManager.getSubscription()

      // If VAPID keys changed since this device originally subscribed, the existing
      // endpoint is unusable. Replace it with a subscription tied to the current key.
      if (sub && !subscriptionUsesKey(sub, publicKey)) {
        await sub.unsubscribe()
        sub = null
      }

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      await saveSubscription(sub)
      setStatus('on')
      setMessage('Enabled and synced with the server.')
    } catch (e) {
      console.error(e)
      setStatus('error')
      setMessage(
        e instanceof Error
          ? e.message
          : 'Enable failed. On iPhone: Add to Home Screen first, then try again.'
      )
    }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus('off')
      setMessage('Notifications off for this device.')
    } catch {
      setStatus('error')
      setMessage('Could not disable notifications cleanly.')
    }
  }

  async function testPush() {
    setTesting(true)
    setMessage('')
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Test push failed.')
      }

      if (data.sent > 0) {
        setMessage(`Test sent to ${data.sent} subscription${data.sent === 1 ? '' : 's'}.`)
      } else if (data.reason === 'no-subscriptions') {
        setMessage('Server has no saved device subscription. Tap enable to reconnect.')
        setStatus('off')
      } else if (data.reason === 'missing-vapid') {
        setMessage('VAPID keys are missing in the production environment.')
      } else if (data.reason === 'subscription-query-failed') {
        setMessage('The server could not read saved push subscriptions.')
      } else if (data.reason === 'delivery-failed') {
        setMessage('The push service rejected the saved subscription. Re-enable notifications.')
        setStatus('off')
      } else {
        setMessage('No notification was delivered. Re-enable notifications and test again.')
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Test push failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">Notifications</p>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Let companions reach you when they check in. On iPhone this only works after{' '}
        <span className="text-zinc-300">Share → Add to Home Screen</span>, then open the icon and
        enable here.
      </p>

      {status === 'loading' && <p className="text-sm text-zinc-500">Checking…</p>}
      {status === 'unsupported' && (
        <p className="text-sm text-amber-300/90">This browser does not support web push.</p>
      )}
      {status === 'need-keys' && (
        <p className="text-sm text-amber-300/90">
          VAPID keys missing on the server. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in
          Vercel, then redeploy.
        </p>
      )}
      {status === 'denied' && (
        <p className="text-sm text-rose-300/90">
          Permission blocked. Reset it in iOS Settings → Notifications (or site settings).
        </p>
      )}

      {(status === 'off' || status === 'error') && (
        <button
          type="button"
          onClick={enable}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition"
        >
          Enable companion notifications
        </button>
      )}

      {status === 'on' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={testPush}
            disabled={testing}
            className="py-3 rounded-xl bg-violet-700 hover:bg-violet-600 disabled:opacity-60 text-sm font-medium transition"
          >
            {testing ? 'Sending…' : 'Send test'}
          </button>
          <button
            type="button"
            onClick={disable}
            className="py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 transition"
          >
            Turn off
          </button>
        </div>
      )}

      {message && <p className="text-xs text-zinc-500 leading-relaxed">{message}</p>}
    </div>
  )
}
