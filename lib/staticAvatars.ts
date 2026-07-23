/**
 * Pre-made portraits — embedded locked headshots + chibis (no image upload required).
 */
import { SERAPHINE_HEADSHOT_JPEG_BASE64 } from './avatarData/seraphine'
import { SERAPHINE_CHIBI_JPEG_BASE64 } from './avatarData/seraphineChibi'

const EMBEDDED_HEADSHOTS: Record<string, string> = {
  seraphine: `data:image/jpeg;base64,${SERAPHINE_HEADSHOT_JPEG_BASE64}`,
}

const EMBEDDED_CHIBIS: Record<string, string> = {
  seraphine: `data:image/jpeg;base64,${SERAPHINE_CHIBI_JPEG_BASE64}`,
}

export function staticHeadshotPath(slug: string): string {
  return `/avatars/${slug}.jpg`
}

export function staticChibiPath(slug: string): string {
  return `/avatars/${slug}-chibi.jpg`
}

export const STATIC_HEADSHOTS = new Set<string>(Object.keys(EMBEDDED_HEADSHOTS))
export const STATIC_CHIBIS = new Set<string>(Object.keys(EMBEDDED_CHIBIS))

export function hasStaticHeadshot(slug: string): boolean {
  return slug in EMBEDDED_HEADSHOTS
}

export function hasStaticChibi(slug: string): boolean {
  return slug in EMBEDDED_CHIBIS
}

export function resolveHeadshot(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (EMBEDDED_HEADSHOTS[slug]) return EMBEDDED_HEADSHOTS[slug]
  if (dbImageUrl) return dbImageUrl
  return null
}

export function resolveChibi(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (EMBEDDED_CHIBIS[slug]) return EMBEDDED_CHIBIS[slug]
  // Fallback: headshot, then DB image
  if (EMBEDDED_HEADSHOTS[slug]) return EMBEDDED_HEADSHOTS[slug]
  if (dbImageUrl) return dbImageUrl
  return null
}
