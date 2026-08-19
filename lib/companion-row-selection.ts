export type CompanionRowLike = {
  id?: string | null
  name?: string | null
  slug?: string | null
  affinity_score?: number | null
  bond_xp?: number | null
  trust_score?: number | null
  intimacy_score?: number | null
  image_url?: string | null
}

function n(value: number | null | undefined): number {
  return Number(value) || 0
}

/**
 * Score duplicate legacy rows by how much relationship progress they contain.
 * This lets an old save converge on the row with the newest rewards rather than
 * whichever duplicate Supabase happens to return first.
 */
export function companionProgressScore(row: CompanionRowLike): number {
  return (
    n(row.affinity_score) * 10_000 +
    n(row.bond_xp) * 10 +
    n(row.trust_score) * 5 +
    n(row.intimacy_score) * 5
  )
}

export function pickCanonicalCompanionRow<T extends CompanionRowLike>(
  rows: T[],
  opts: {
    canonicalName?: string | null
    slug?: string | null
    preferImage?: boolean
  }
): T | undefined {
  const byName = opts.canonicalName
    ? rows.filter((row) => row.name === opts.canonicalName)
    : []
  const bySlug = opts.slug ? rows.filter((row) => row.slug === opts.slug) : []
  const candidates = byName.length > 0 ? byName : bySlug

  return [...candidates].sort((a, b) => {
    if (opts.preferImage) {
      const imageDelta = Number(Boolean(b.image_url)) - Number(Boolean(a.image_url))
      if (imageDelta !== 0) return imageDelta
    }
    return companionProgressScore(b) - companionProgressScore(a)
  })[0]
}
