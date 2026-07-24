/**
 * Weighted Task Ontology + Self-Neglect
 */

import {
  DOMAIN_BASE_WEIGHTS,
  type LifeDomain,
  type DomainAggregate,
  type SelfNeglectResult,
  type SelfNeglectSeverity,
} from './types'

const SELF_SKILLS = new Set([
  'faith',
  'discipline',
  'fitness',
  'rest',
  'recovery',
  'piano',
  'fishing',
  'wisdom',
  'self',
])

const RELATIONSHIP_SKILLS = new Set([
  'relations',
  'relationship',
  'marriage',
  'family',
  'community',
])

const STEWARDSHIP_SKILLS = new Set([
  'stewardship',
  'business',
  'clients',
  'work',
  'office',
  'finance',
])

const LEGACY_SKILLS = new Set([
  'legacy',
  'writing',
  'vision',
  'ministry',
  'teaching',
])

/** Title keywords that count as Self even without a domain tag */
const SELF_TITLE_RE =
  /\b(fish|fishing|piano|practice|recover|recovery|rest|sleep|nap|walk|run|workout|gym|stretch|sabbath|quiet time|devotion|journal|hobby)\b/i

export function skillToDomain(skill: string): LifeDomain {
  const s = skill.toLowerCase().trim()
  if (SELF_SKILLS.has(s)) return 'self'
  if (RELATIONSHIP_SKILLS.has(s)) return 'relationship'
  if (STEWARDSHIP_SKILLS.has(s)) return 'stewardship'
  if (LEGACY_SKILLS.has(s)) return 'legacy'
  return 'domain'
}

/** Infer an extra Self tag from the task title when domains are thin */
export function selfTagFromTitle(title: string | null | undefined): string | null {
  if (!title) return null
  return SELF_TITLE_RE.test(title) ? 'self' : null
}

export function aggregateDomains(
  domainTags: string[],
  opts?: { basePointsPerTask?: number; titles?: string[] }
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

  // Title-based Self credit when the word appears but no Self domain was tagged
  for (const title of opts?.titles || []) {
    if (selfTagFromTitle(title)) {
      out.self += base * DOMAIN_BASE_WEIGHTS.self * 0.6
    }
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

export function debtToMultiplier(currentDebt: number): number {
  return Math.max(0.6, Number((1 - currentDebt * 0.004).toFixed(3)))
}
