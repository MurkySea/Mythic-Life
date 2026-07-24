/**
 * Mythic Life – Goals Engine
 *
 * Goals sit above daily tasks. They are weighted, time-bound (or ongoing)
 * real-life objectives under stable pillars. Completing them feeds
 * Consistency Tokens and can deepen companion relationships.
 * Neglecting them feeds Shadow Debt and can cool Trust.
 *
 * Pure functions. Designed 2026-07-24.
 */

import type { LifeDomain } from './types'

// ─────────────────────────────────────────────
// Pillars
// ─────────────────────────────────────────────

/**
 * Stable life domains the Leader is building under.
 * Maps closely to existing LifeDomain + skills.
 */
export type GoalPillar =
  | 'stewardship' // work, clients, Edward Jones, finance
  | 'faith' // Bible study, discipleship, ministry
  | 'marriage' // Lauren, partnership, shared life
  | 'body' // sleep/rhythm, fitness, recovery
  | 'homestead' // land, building, future family place
  | 'legacy' // vision, mentoring, systems that outlive you
  | 'self' // piano, fishing, growth practices

export const PILLAR_LABELS: Record<GoalPillar, string> = {
  stewardship: 'Stewardship',
  faith: 'Faith',
  marriage: 'Marriage',
  body: 'Body & Rhythm',
  homestead: 'Homestead',
  legacy: 'Legacy',
  self: 'Self',
}

export const PILLAR_TO_DOMAIN: Record<GoalPillar, LifeDomain> = {
  stewardship: 'stewardship',
  faith: 'self',
  marriage: 'relationship',
  body: 'self',
  homestead: 'legacy',
  legacy: 'legacy',
  self: 'self',
}

/** Which companions care most about which pillars (for reactions) */
export const COMPANION_PILLAR_CARE: Record<string, GoalPillar[]> = {
  seraphine: ['faith', 'body', 'legacy'],
  kira_foxveil: ['faith', 'marriage'],
  ember_crimsonfall: ['body', 'self'],
  nyx_voidbane: ['faith', 'self'],
  mira_quillweave: ['legacy', 'stewardship'],
  lyra_dawnforge: ['faith', 'marriage'],
  // default: care lightly about everything
}

// ─────────────────────────────────────────────
// Goal model
// ─────────────────────────────────────────────

export type GoalStatus = 'active' | 'completed' | 'abandoned' | 'paused'

export type GoalHorizon = 'daily' | 'weekly' | 'monthly' | 'season' | 'ongoing'

export interface Goal {
  id: string
  title: string
  pillar: GoalPillar
  /** 1–5 how much this goal matters relative to others */
  weight: number
  horizon: GoalHorizon
  /** Target count (e.g. 12 reviews, 6 weeks, 14 consistent nights) */
  target: number
  progress: number
  status: GoalStatus
  createdAt: string // YYYY-MM-DD
  completedAt?: string
  notes?: string
  /** Optional linked skill keys for ontology */
  skills?: string[]
}

export interface GoalCompletionResult {
  goal: Goal
  tokenGain: number
  xpGain: number
  goldGain: number
  trustDelta: number // applied to companions who care about this pillar
  intimacyDelta: number
  note: string
}

export interface GoalNeglectResult {
  goal: Goal
  shadowDebtAdded: number
  trustDelta: number // negative, applied to caring companions
  note: string
}

// ─────────────────────────────────────────────
// Creation & progress
// ─────────────────────────────────────────────

export function createGoal(input: {
  id: string
  title: string
  pillar: GoalPillar
  weight?: number
  horizon?: GoalHorizon
  target: number
  date: string
  skills?: string[]
  notes?: string
}): Goal {
  return {
    id: input.id,
    title: input.title,
    pillar: input.pillar,
    weight: Math.max(1, Math.min(5, input.weight ?? 3)),
    horizon: input.horizon ?? 'weekly',
    target: Math.max(1, input.target),
    progress: 0,
    status: 'active',
    createdAt: input.date,
    skills: input.skills,
    notes: input.notes,
  }
}

/** Advance progress. Returns updated goal + whether it just completed. */
export function advanceGoal(
  goal: Goal,
  amount: number,
  date: string
): { goal: Goal; justCompleted: boolean } {
  if (goal.status !== 'active') {
    return { goal, justCompleted: false }
  }

  const nextProgress = Math.min(goal.target, goal.progress + amount)
  const justCompleted = nextProgress >= goal.target && goal.progress < goal.target

  return {
    goal: {
      ...goal,
      progress: nextProgress,
      status: justCompleted ? 'completed' : goal.status,
      completedAt: justCompleted ? date : goal.completedAt,
    },
    justCompleted,
  }
}

// ─────────────────────────────────────────────
// Rewards on completion
// ─────────────────────────────────────────────

/**
 * Token / XP / relationship effects when a goal is completed.
 * Weight and horizon scale the rewards.
 */
export function getCompletionRewards(goal: Goal): GoalCompletionResult {
  const horizonMul: Record<GoalHorizon, number> = {
    daily: 0.6,
    weekly: 1.0,
    monthly: 1.8,
    season: 3.0,
    ongoing: 1.2,
  }

  const h = horizonMul[goal.horizon]
  const w = goal.weight

  const tokenGain = Number((0.8 * w * h).toFixed(2))
  const xpGain = Math.round(40 * w * h)
  const goldGain = Math.round(18 * w * h)

  // Completing a real goal slightly deepens trust with the whole party
  // and intimacy with companions who care about this pillar
  const trustDelta = Number((0.8 + w * 0.3).toFixed(1))
  const intimacyDelta = Number((1.2 + w * 0.4).toFixed(1))

  return {
    goal,
    tokenGain,
    xpGain,
    goldGain,
    trustDelta,
    intimacyDelta,
    note: `Goal complete: “${goal.title}”. The path holds.`,
  }
}

// ─────────────────────────────────────────────
// Neglect
// ─────────────────────────────────────────────

/**
 * Call when a goal is abandoned or heavily overdue.
 * Weight drives how much Shadow Debt and Trust damage it causes.
 */
export function getNeglectPenalty(goal: Goal): GoalNeglectResult {
  const debt = Number((2 + goal.weight * 1.5).toFixed(1))
  const trustDelta = Number((-1.5 - goal.weight * 0.5).toFixed(1))

  return {
    goal: { ...goal, status: 'abandoned' },
    shadowDebtAdded: debt,
    trustDelta,
    note: `Goal abandoned: “${goal.title}”. Something was left unfinished.`,
  }
}

// ─────────────────────────────────────────────
// Companion reactions to goals
// ─────────────────────────────────────────────

export function companionsWhoCareAbout(
  pillar: GoalPillar,
  companionSlugs: string[]
): string[] {
  return companionSlugs.filter((slug) => {
    const cares = COMPANION_PILLAR_CARE[slug]
    if (!cares) return true // unknown companions care generically
    return cares.includes(pillar)
  })
}

/** Short seed for companion voice when a goal in their domain completes */
export function goalCompletionVoiceSeed(
  companionName: string,
  goal: Goal
): string {
  return `${companionName} noticed he finished a real goal in ${PILLAR_LABELS[goal.pillar]}: “${goal.title}”. React as someone who cares about that domain — short, human, no scoreboard language.`
}

/** Short seed when a cared-about goal is neglected */
export function goalNeglectVoiceSeed(
  companionName: string,
  goal: Goal
): string {
  return `${companionName} noticed the goal “${goal.title}” (${PILLAR_LABELS[goal.pillar]}) was left behind. Soft concern or quiet disappointment in her voice — not a lecture.`
}

// ─────────────────────────────────────────────
// Aggregation helpers
// ─────────────────────────────────────────────

export function activeGoals(goals: Goal[]): Goal[] {
  return goals.filter((g) => g.status === 'active')
}

export function goalsByPillar(goals: Goal[]): Record<GoalPillar, Goal[]> {
  const out = {} as Record<GoalPillar, Goal[]>
  for (const p of Object.keys(PILLAR_LABELS) as GoalPillar[]) {
    out[p] = []
  }
  for (const g of goals) {
    out[g.pillar].push(g)
  }
  return out
}

export function pillarLoad(goals: Goal[]): Record<GoalPillar, number> {
  const out = {} as Record<GoalPillar, number>
  for (const p of Object.keys(PILLAR_LABELS) as GoalPillar[]) {
    out[p] = 0
  }
  for (const g of activeGoals(goals)) {
    out[g.pillar] += g.weight * (g.progress / Math.max(1, g.target))
  }
  return out
}
