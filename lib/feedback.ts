import { cookies } from 'next/headers'

export type FeedbackPayload = {
  skillGains: { skill: string; label: string; xp: number; level: number }[]
  bondXp: number
  companionName: string
  companionSlug: string
  unlocked: { name: string; slug: string; emoji: string; line: string }[]
  streak?: number
}

const COOKIE = 'ml_feedback'

/** Only call from Server Actions */
export async function setFeedback(payload: FeedbackPayload) {
  const store = await cookies()
  store.set(COOKIE, JSON.stringify(payload), {
    path: '/',
    maxAge: 120,
    httpOnly: false,
    sameSite: 'lax',
  })
}

/**
 * Read feedback in a Server Component.
 * Does NOT delete the cookie (cookie mutation is illegal during RSC render and breaks builds).
 * Cookie expires via maxAge; next setFeedback overwrites.
 */
export async function readFeedback(): Promise<FeedbackPayload | null> {
  try {
    const store = await cookies()
    const raw = store.get(COOKIE)?.value
    if (!raw) return null
    return JSON.parse(raw) as FeedbackPayload
  } catch {
    return null
  }
}

/** Clear from a Server Action only */
export async function clearFeedback() {
  const store = await cookies()
  store.delete(COOKIE)
}
