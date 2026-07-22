/**
 * Pre-made portraits — embedded locked headshots + optional /public/avatars files.
 */

const EMBEDDED_HEADSHOTS: Record<string, string> = {
  // NOTE: seraphine data URI is loaded from companion static file below via runtime constant
  // Placeholder until full embed is applied in follow-up if payload too large
}

export function staticHeadshotPath(slug: string): string {
  return `/avatars/${slug}.png`
}

export function staticChibiPath(slug: string): string {
  return `/avatars/${slug}-chibi.png`
}

export const STATIC_HEADSHOTS = new Set<string>(['seraphine'])

export const STATIC_CHIBIS = new Set<string>([])

export function hasStaticHeadshot(slug: string): boolean {
  return STATIC_HEADSHOTS.has(slug) || slug in EMBEDDED_HEADSHOTS
}

export function hasStaticChibi(slug: string): boolean {
  return STATIC_CHIBIS.has(slug)
}

export function resolveHeadshot(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (EMBEDDED_HEADSHOTS[slug]) return EMBEDDED_HEADSHOTS[slug]
  // Prefer public file when present in deploy
  if (STATIC_HEADSHOTS.has(slug)) return staticHeadshotPath(slug)
  if (dbImageUrl) return dbImageUrl
  return null
}

export function resolveChibi(
  slug: string,
  dbImageUrl?: string | null
): string | null {
  if (STATIC_CHIBIS.has(slug)) return staticChibiPath(slug)
  if (EMBEDDED_HEADSHOTS[slug]) return EMBEDDED_HEADSHOTS[slug]
  if (STATIC_HEADSHOTS.has(slug)) return staticHeadshotPath(slug)
  if (dbImageUrl) return dbImageUrl
  return null
}
