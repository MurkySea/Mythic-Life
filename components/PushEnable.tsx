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

type Status = 'loading' | 'unsupported' | 'need-keys' | 'off' | 'on' | 'denied' | 'error'

export default function PushEnable() {
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (!publicKey) {
      setStatus('need-keys')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setStatus(sub ? 'on' : 'off')
      })
      .catch(() => setStatus('error'))
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
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.hint || data.error || 'Could not save subscription')
        return
      }
      setStatus('on')
      setMessage('Enabled. Companions can notify this device.')
    } catch (e) {
      console.error(e)
      setStatus('error')
      setMessage('Enable failed. On iPhone: Add to Home Screen first, then try again.')
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
        <button
          type="button"
          onClick={disable}
          className="w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 transition"
        >
          Notifications on — tap to disable
        </button>
      )}

      {message && <p className="text-xs text-zinc-500 leading-relaxed">{message}</p>}
    </div>
  )
}
