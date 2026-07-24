/**
 * Mythic Life pure engine types
 * Domains, scoring context, and dual-track rewards.
 */

export type LifeDomain =
  | 'stewardship'
  | 'self'
  | 'domain'
  | 'relationship'
  | 'legacy'

export const DOMAIN_BASE_WEIGHTS: Record<LifeDomain, number> = {
  stewardship: 1.15,
  self: 1.4,
  domain: 1.1,
  relationship: 1.25,
  legacy: 1.2,
}

export type SelfNeglectSeverity = 'none' | 'mild' | 'moderate' | 'severe'

export interface EffortProfile {
  timeMinutes: number
  cognitiveLoad: number // 1–5
  emotionalCost: number // 1–5
}

export interface DomainAggregate {
  domain: LifeDomain
  score: number
  taskCount: number
}

export interface SelfNeglectResult {
  severity: SelfNeglectSeverity
  ratio: number
  selfScore: number
  totalScore: number
  recommendedDebtWeight: number
  selfMultiplier: number
}

export interface DualTrackTotals {
  xp: number
  gold: number
  tokens: number
}

export interface MultiplierStack {
  rhythm: number
  truth: number
  shadowDebt: number
  selfNeglect: number
  combined: number
}
