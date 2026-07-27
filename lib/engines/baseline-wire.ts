/**
 * Personal baseline ladder → live systems bridge
 *
 * Scores a night against the player's current phase windows
 * (not the hard ideal), applies PERSONAL_TIER_EFFECTS to Shadow Debt
 * and related multipliers, and advances phase on Good+ streaks.
 *
 * Designed 2026-07-27.
 */

import {
  type BaselineProgress,
  type DailyTier,
  getPhase,
  scorePersonalDay,
  advanceProgress,
  PERSONAL_TIER_EFFECTS,
  createInitialProgress,
} from './personal-baseline'
import type { PlayerStandingRow } from './standing-store'

/** Minutes-from-midnight in America/Chicago from an ISO-ish timestamp. */
export function chicagoMinutesFromMidnight(iso: string): number | null {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(d)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN)
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    // Intl may emit "24" for midnight in some engines — normalize
    const h = hour === 24 ? 0 : hour
    return ((h * 60 + minute) % 1440 + 1440) % 1440
  } catch {
    return null
  }
}

export function progressFromStanding(row: PlayerStandingRow): BaselineProgress {
  return {
    currentPhase: Math.max(1, row.baseline_phase || 1),
    goodStreak: Math.max(0, row.baseline_good_streak || 0),
    lastEvaluatedDate: row.last_rhythm_date || undefined,
  }
}

export interface LadderScoreInput {
  bedtimeIso?: string | null
  wakeIso?: string | null
  totalSleepHours?: number | null
  restingHeartRate?: number | null
  hrvMs?: number | null
  standMinutes?: number | null
  activeEnergyKcal?: number | null
}

export interface LadderScoreResult {
  tier: DailyTier
  summary: string
  phase: number
  phaseName: string
  phaseLabel: string
  effects: (typeof PERSONAL_TIER_EFFECTS)[DailyTier]
  /** Updated progress after this night (call saveStanding with these) */
  nextProgress: BaselineProgress
  hits: ReturnType<typeof scorePersonalDay>['hits']
}

/**
 * Score a night against the current personal baseline phase.
 * Does not persist — caller writes nextProgress via saveStanding.
 */
export function scoreNightWithLadder(
  standing: PlayerStandingRow,
  input: LadderScoreInput,
  evaluatedDate: string
): LadderScoreResult | null {
  const progress = progressFromStanding(standing)
  const phase = getPhase(progress)

  const bedtimeMinutes = input.bedtimeIso
    ? chicagoMinutesFromMidnight(input.bedtimeIso)
    : undefined
  const wakeMinutes = input.wakeIso
    ? chicagoMinutesFromMidnight(input.wakeIso)
    : undefined

  // Need at least timing or duration to score
  if (
    bedtimeMinutes == null &&
    wakeMinutes == null &&
    input.totalSleepHours == null
  ) {
    return null
  }

  const scored = scorePersonalDay(
    {
      bedtimeMinutes: bedtimeMinutes ?? undefined,
      wakeMinutes: wakeMinutes ?? undefined,
      totalSleepHours: input.totalSleepHours ?? undefined,
      restingHeartRate: input.restingHeartRate ?? undefined,
      hrvMs: input.hrvMs ?? undefined,
      standMinutes: input.standMinutes ?? undefined,
      activeEnergyKcal: input.activeEnergyKcal ?? undefined,
    },
    progress
  )

  const nextProgress = advanceProgress(progress, scored.tier, evaluatedDate)
  const effects = PERSONAL_TIER_EFFECTS[scored.tier]

  const bedWindow = phase.windows.bedtime
  const wakeWindow = phase.windows.wake
  const phaseLabel = [
    bedWindow ? `bed ${bedWindow.label}` : null,
    wakeWindow ? `wake ${wakeWindow.label}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    tier: scored.tier,
    summary: scored.summary,
    phase: phase.phase,
    phaseName: phase.name,
    phaseLabel,
    effects,
    nextProgress,
    hits: scored.hits,
  }
}

export function defaultProgress(): BaselineProgress {
  return createInitialProgress()
}
