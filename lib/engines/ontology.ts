/**
 * Weighted Task Ontology + Self-Neglect
 *
 * Maps existing skill domains onto LifeDomain and detects
 * when regenerative Self work is too thin relative to output.
 */

import {
  DOMAIN_BASE_WEIGHTS,
  type LifeDomain,
  type DomainAggregate,
  type SelfNeglectResult,
  type SelfNeglectSeverity,
} from './types'

/** Map existing skill keys → LifeDomain */
export function skillToDomain(skill: string): LifeDomain {
  const s = skill.toLowerCase()

  // Self — regenerative / body / mind care
  if (
    ['faith', 'discipline', 'fitness', 'rest', 'recovery', 'piano', 'fishing', 'wisdom'].includes(s)
  ) {
    return 'self'
  }

  // Relationship
  if (['relations', 'relationship', 'marriage', 'family', 'community'].includes(s)) {
    return 'relationship'
  }

  // Stewardship — clients, money, office
  if (['stewardship', 'business', 'clients', 'work', 'office', 'finance'].includes(s)) {
    return 'stewardship'
  }

  // Legacy
  if (['legacy', 'writing', 'vision', 'ministry', 'teaching'].includes(s)) {
    return 'legacy'
  }

  // Knowledge / general craft falls into domain for now
  return 'domain'
}

/**
 * Aggregate domain scores from a list of completed task domain tags.
 * Each tag contributes base weight × simple effort proxy.
 */
export function aggregateDomains(
  domainTags: string[],
  opts?: { basePointsPerTask?: number }
): Record<LifeDomain, number> {
  const base = opts?.basePointsPerTask ?? 30
  const out: Record<LifeDomain, number> = {
    stewardship: 0,
    self: 0,
    domain: 0,
    relationship: 0,
    legacy: 0,
  }

  for (const tag of domainTags) {
    const d = skillToDomain(tag)
    out[d] += base * DOMAIN_BASE_WEIGHTS[d]
  }

  return out
}

export function domainList(aggregates: Record<LifeDomain, number>): DomainAggregate[] {
  return (Object.entries(aggregates) as [LifeDomain, number][]).map(([domain, score]) => ({
    domain,
    score: Number(score.toFixed(1)),
    taskCount: 0,
  }))
}

/**
 * Self-Neglect: Self score too thin relative to total output.
 * Only ever produces a multiplier dampener (never a hard block).
 */
export function detectSelfNeglect(
  aggregates: Record<LifeDomain, number>
): SelfNeglectResult {
  const selfScore = aggregates.self || 0
  const totalScore = Object.values(aggregates).reduce((a, b) => a + b, 0)
  const ratio = totalScore > 0 ? selfScore / totalScore : 1

  let severity: SelfNeglectSeverity = 'none'
  let recommendedDebtWeight = 0
  let selfMultiplier = 1

  if (totalScore >= 80) {
    if (ratio < 0.08) {
      severity = 'severe'
      recommendedDebtWeight = 12
      selfMultiplier = 0.7
    } else if (ratio < 0.15) {
      severity = 'moderate'
      recommendedDebtWeight = 7
      selfMultiplier = 0.82
    } else if (ratio < 0.22) {
      severity = 'mild'
      recommendedDebtWeight = 3
      selfMultiplier = 0.92
    }
  }

  return {
    severity,
    ratio: Number(ratio.toFixed(3)),
    selfScore: Number(selfScore.toFixed(1)),
    totalScore: Number(totalScore.toFixed(1)),
    recommendedDebtWeight,
    selfMultiplier,
  }
}

/** Map current debt into a 0.60–1.00 multiplier */
export function debtToMultiplier(currentDebt: number): number {
  return Math.max(0.6, Number((1 - currentDebt * 0.004).toFixed(3)))
}
