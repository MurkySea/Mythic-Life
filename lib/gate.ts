import { createHmac, timingSafeEqual } from 'crypto'

export const GATE_COOKIE = 'mythic_gate'
export const GATE_MAX_AGE = 60 * 60 * 24 * 60 // 60 days

function secretMaterial(): string {
  return (
    process.env.GATE_COOKIE_SECRET ||
    process.env.SITE_PASSWORD ||
    'mythic-life-dev-only'
  )
}

/** Stable token derived from the current site password. Changing SITE_PASSWORD invalidates old cookies. */
export function expectedGateToken(): string {
  const password = process.env.SITE_PASSWORD || ''
  return createHmac('sha256', secretMaterial()).update(`gate:${password}`).digest('hex')
}

export function isValidGateToken(token: string | undefined | null): boolean {
  if (!token) return false
  const expected = expectedGateToken()
  try {
    const a = Buffer.from(token)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function passwordConfigured(): boolean {
  return Boolean(process.env.SITE_PASSWORD && process.env.SITE_PASSWORD.length > 0)
}

export function checkPassword(input: string): boolean {
  const expected = process.env.SITE_PASSWORD || ''
  if (!expected) return false
  try {
    const a = Buffer.from(input)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
