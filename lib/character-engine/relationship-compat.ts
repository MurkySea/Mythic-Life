import { deriveDualAxis } from '@/lib/engines/relationship-wire'

export type CompanionRelationshipSource = {
  slug?: string | null
  affinity_score?: number | null
  bond_xp?: number | null
  trust_score?: number | null
  intimacy_score?: number | null
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Postgres reports an unknown selected column with 42703. Keep the text fallback
 * because PostgREST can wrap database errors differently across versions.
 */
export function isMissingRelationshipColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    code?: unknown
    message?: unknown
    details?: unknown
    hint?: unknown
  }
  if (String(candidate.code || '') === '42703') return true

  const text = [candidate.message, candidate.details, candidate.hint]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toLowerCase()

  const mentionsRelationshipColumn =
    text.includes('trust_score') || text.includes('intimacy_score')
  const looksMissing =
    text.includes('does not exist') ||
    text.includes('unknown column') ||
    text.includes('could not find')

  return mentionsRelationshipColumn && looksMissing
}

/**
 * Normalize either a modern companion row or a legacy row into the dual-axis
 * relationship shape expected by Character Engine cognition.
 *
 * Stored Trust/Intimacy remain authoritative when present. Legacy rows derive
 * temporary values from bond/affinity using the same mapping as the relationship
 * engine, so schema drift does not disable cognition while a migration is pending.
 */
export function withRelationshipFallback<T extends CompanionRelationshipSource>(
  companion: T,
  companionSlug: string
): T & { trust_score: number; intimacy_score: number } {
  const dual = deriveDualAxis({
    slug: String(companion.slug || companionSlug),
    affinity_score: finiteNumber(companion.affinity_score, 1),
    bond_xp: finiteNumber(companion.bond_xp, 0),
    trust_score: companion.trust_score,
    intimacy_score: companion.intimacy_score,
  })

  return {
    ...companion,
    trust_score: dual.trust.value,
    intimacy_score: dual.intimacy.value,
  }
}
