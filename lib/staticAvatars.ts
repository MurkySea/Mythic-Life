/**
 * Pre-made portraits live in /public/avatars/
 *   {slug}.jpg        — base headshot (profile / unlock default)
 *   {slug}-chibi.jpg  — message-list icon
 *
 * Add files by committing them to the repo. The app never generates these on the fly.
 */

export function staticHeadshotPath(slug: string): string {
  return `/avatars/${slug}.jpg`
}

export function staticChibiPath(slug: string): string {
  return `/avatars/${slug}-chibi.jpg`
}

/** Known slugs that have committed base art */
export const STATIC_HEADSHOTS = new Set<string>([
  'seraphine', // locked 2026-07-22 — semi-real anime blend, realistic nose, warm smile
])

export const STATIC_CHIBIS = new Set<string>([
  // next: seraphine-chibi
])

export function hasStaticHeadshot(slug: string): boolean {
  return STATIC_HEADSHOTS.has(slug)
}

export function hasStaticChibi(slug: string): boolean {
  return STATIC_CHIBIS.has(slug)
}

/** Prefer static file → DB image_url → null (caller shows emoji). */
export function resolveHeadshot(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (hasStaticHeadshot(slug)) return staticHeadshotPath(slug)
  if (dbImageUrl) return dbImageUrl
  return null
}

export function resolveChibi(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (hasStaticChibi(slug)) return staticChibiPath(slug)
  // until chibi exists, use headshot in the circle
  if (hasStaticHeadshot(slug)) return staticHeadshotPath(slug)
  if (dbImageUrl) return dbImageUrl
  return null
}
