'use client'

import { useEffect } from 'react'

/**
 * Forces the conversation to be marked read the moment the chat opens
 * and again when the user leaves. This bypasses any server-component
 * timing or silent RLS failures.
 */
export default function MarkReadOnOpen({ companionSlug }: { companionSlug: string }) {
  useEffect(() => {
    if (!companionSlug) return

    let cancelled = false

    async function mark() {
      if (cancelled) return
      try {
        await fetch('/api/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companion_slug: companionSlug }),
          keepalive: true, // important for the leave / unmount case
        })
      } catch {
        // ignore network errors
      }
    }

    // Mark immediately on open
    mark()

    // Keep marking while the tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') mark()
    }, 3000)

    // Mark one last time when the user leaves the page
    const onLeave = () => mark()
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('beforeunload', onLeave)

    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('beforeunload', onLeave)
      // Final mark on unmount
      mark()
    }
  }, [companionSlug])

  return null
}
