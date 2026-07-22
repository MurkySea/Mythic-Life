/**
 * Pre-made portraits — embedded locked headshots (no image upload required).
 */
import { SERAPHINE_HEADSHOT_JPEG_BASE64 } from './avatarData/seraphine'

const EMBEDDED_HEADSHOTS: Record<string, string> = {
  seraphine: `data:image/jpeg;base64,${SERAPHINE_HEADSHOT_JPEG_BASE64}`,
}

export function staticHeadshotPath(slug: string): string {
  return `/avatars/${slug}.jpg`
}

export function staticChibiPath(slug: string): string {
  return `/avatars/${slug}-chibi.jpg`
}

export const STATIC_HEADSHOTS = new Set<string>(Object.keys(EMBEDDED_HEADSHOTS))
export const STATIC_CHIBIS = new Set<string>([])

export function hasStaticHeadshot(slug: string): boolean {
  return slug in EMBEDDED_HEADSHOTS
}

export function hasStaticChibi(slug: string): boolean {
  return STATIC_CHIBIS.has(slug)
}

export function resolveHeadshot(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (EMBEDDED_HEADSHOTS[slug] && !EMBEDDED_HEADSHOTS[slug].endsWith('PENDING')) {
    return EMBEDDED_HEADSHOTS[slug]
  }
  if (dbImageUrl) return dbImageUrl
  return null
}

export function resolveChibi(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (STATIC_CHIBIS.has(slug)) return staticChibiPath(slug)
  const head = resolveHeadshot(slug, dbImageUrl)
  if (head) return head
  if (dbImageUrl) return dbImageUrl
  return null
}
