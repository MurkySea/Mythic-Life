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

export async function setFeedback(payload: FeedbackPayload) {
  const store = await cookies()
  store.set(COOKIE, JSON.stringify(payload), {
    path: '/',
    maxAge: 120,
    httpOnly: false,
    sameSite: 'lax',
  })
}

export async function readAndClearFeedback(): Promise<FeedbackPayload | null> {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value
  if (!raw) return null
  try {
    store.delete(COOKIE)
    return JSON.parse(raw) as FeedbackPayload
  } catch {
    store.delete(COOKIE)
    return null
  }
}
