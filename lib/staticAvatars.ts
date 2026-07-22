/**
 * Pre-made portraits live in /public/avatars/
 *   {slug}.png        — base headshot (profile / unlock default)
 *   {slug}-chibi.png  — message-list icon
 *
 * Add files by committing them to the repo. The app never generates these on the fly.
 */

export function staticHeadshotPath(slug: string): string {
  return `/avatars/${slug}.png`
}

export function staticChibiPath(slug: string): string {
  return `/avatars/${slug}-chibi.png`
}

/** Known slugs that have committed base art (update when you add files). */
export const STATIC_HEADSHOTS = new Set<string>([
  // filled as we commit portraits, e.g. 'seraphine'
])

export const STATIC_CHIBIS = new Set<string>([
  // filled as we commit chibi icons
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
  // fallback: use headshot in the circle if no chibi yet
  if (hasStaticHeadshot(slug)) return staticHeadshotPath(slug)
  if (dbImageUrl) return dbImageUrl
  return null
}
