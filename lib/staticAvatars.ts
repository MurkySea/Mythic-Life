/**
 * Pre-made portraits — embedded locked headshots + chibis (no image upload required).
 *
 * Resolution order (2026-07-27):
 *   1. Explicit companion.image_url (user-picked avatar from gallery)
 *   2. Embedded static for starter companions (Seraphine, etc.)
 *   3. null → emoji fallback in CompanionAvatar
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

/**
 * Profile / list headshot.
 * User-picked `dbImageUrl` always wins so gallery "Set as avatar" works
 * even for companions that ship with an embedded default.
 */
export function resolveHeadshot(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (dbImageUrl) return dbImageUrl
  if (EMBEDDED_HEADSHOTS[slug]) return EMBEDDED_HEADSHOTS[slug]
  return null
}

/**
 * Small list / inbox icon.
 * Prefer explicit avatar, then embedded chibi, then embedded headshot, then db.
 */
export function resolveChibi(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (dbImageUrl) return dbImageUrl
  if (EMBEDDED_CHIBIS[slug]) return EMBEDDED_CHIBIS[slug]
  if (EMBEDDED_HEADSHOTS[slug]) return EMBEDDED_HEADSHOTS[slug]
  return null
}
