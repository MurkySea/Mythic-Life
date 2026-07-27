/**
 * Mythic Life – Personal Adaptive Baseline
 *
 * Derived from Mark's Health Auto Export (2026-04-27 → 2026-07-26).
 * 89 sleep nights, 91 activity/recovery days.
 *
 * Philosophy:
 * - Meet the real average, not a fantasy ideal.
 * - Score against current Phase windows so Good/Excellent is winnable.
 * - Advance the window only after consistent wins (small, sticky steps).
 * - Long-term destination can still be 11:00 PM / 7:30 AM; the path is incremental.
 */

export type MetricKey =
  | 'bedtime'
  | 'wake'
  | 'totalSleepHours'
  | 'standMinutes'
  | 'activeEnergyKcal'
  | 'restingHeartRate'
  | 'hrvMs'

export interface MetricBaseline {
  key: MetricKey
  label: string
  unit: string
  /** Observed average from export */
  observedAvg: number
  /** Observed median */
  observedMedian: number
  /** Observed standard deviation */
  observedStd: number
  /** Direction we want to move (earlier/lower/higher) */
  improveDirection: 'earlier' | 'later' | 'higher' | 'lower'
  /** Long-term destination (optional) */
  ideal?: number
}

/**
 * Raw observed baselines from the Apr–Jul 2026 export.
 * Bedtime/wake stored as minutes-from-midnight.
 * Bedtime after midnight stays as small numbers (e.g. 00:17 = 17).
 */
export const OBSERVED_BASELINES: Record<MetricKey, MetricBaseline> = {
  bedtime: {
    key: 'bedtime',
    label: 'Bedtime',
    unit: 'min-from-midnight',
    observedAvg: 17, // 12:17 AM
    observedMedian: 15,
    observedStd: 65,
    improveDirection: 'earlier',
    ideal: 23 * 60, // 11:00 PM = 1380, but we treat cross-midnight carefully in windows
  },
  wake: {
    key: 'wake',
    label: 'Wake time',
    unit: 'min-from-midnight',
    observedAvg: 8 * 60 + 5, // 8:05 AM = 485
    observedMedian: 8 * 60,
    observedStd: 66,
    improveDirection: 'earlier',
    ideal: 7 * 60 + 30, // 7:30 AM
  },
  totalSleepHours: {
    key: 'totalSleepHours',
    label: 'Total sleep',
    unit: 'hours',
    observedAvg: 7.48,
    observedMedian: 7.3,
    observedStd: 1.32,
    improveDirection: 'higher',
    ideal: 8.0,
  },
  standMinutes: {
    key: 'standMinutes',
    label: 'Stand time',
    unit: 'min',
    observedAvg: 102.6,
    observedMedian: 98,
    observedStd: 45.9,
    improveDirection: 'higher',
    ideal: 120,
  },
  activeEnergyKcal: {
    key: 'activeEnergyKcal',
    label: 'Active energy',
    unit: 'kcal',
    observedAvg: 529.5,
    observedMedian: 516,
    observedStd: 144.6,
    improveDirection: 'higher',
    ideal: 600,
  },
  restingHeartRate: {
    key: 'restingHeartRate',
    label: 'Resting heart rate',
    unit: 'bpm',
    observedAvg: 83.8,
    observedMedian: 84,
    observedStd: 6.0,
    improveDirection: 'lower',
    ideal: 70,
  },
  hrvMs: {
    key: 'hrvMs',
    label: 'HRV',
    unit: 'ms',
    observedAvg: 39.3,
    observedMedian: 38.6,
    observedStd: 7.3,
    improveDirection: 'higher',
    ideal: 50,
  },
}

// ─── Progressive phases ─────────────────────────────────────

export interface PhaseWindow {
  /** Inclusive lower bound (for "higher is better" metrics) or window start */
  min: number
  /** Inclusive upper bound or window end */
  max: number
  /** Human label for UI */
  label: string
}

export interface PhaseConfig {
  phase: number
  name: string
  windows: Partial<Record<MetricKey, PhaseWindow>>
  /** Nights/days of Good+ required to unlock next phase */
  advanceAfterGoodDays: number
}

/**
 * Phase 1 = meet current reality with a gentle pull.
 * Later phases walk toward the ideal in small steps.
 *
 * Bedtime/wake are minutes-from-midnight.
 * Cross-midnight bedtime windows use values like 23*60 + 50 = 1430 for 11:50 PM.
 */
export const PHASES: PhaseConfig[] = [
  {
    phase: 1,
    name: 'Meet Yourself',
    advanceAfterGoodDays: 5,
    windows: {
      // 11:50 PM – 12:40 AM  (centered on 12:17 avg)
      bedtime: { min: 23 * 60 + 50, max: 40, label: '11:50 PM – 12:40 AM' },
      // 7:40 – 8:30 AM
      wake: { min: 7 * 60 + 40, max: 8 * 60 + 30, label: '7:40 – 8:30 AM' },
      totalSleepHours: { min: 7.0, max: 10.0, label: '≥ 7.0 h' },
      standMinutes: { min: 90, max: 999, label: '≥ 90 min' },
      activeEnergyKcal: { min: 480, max: 9999, label: '≥ 480 kcal' },
      restingHeartRate: { min: 40, max: 82, label: '≤ 82 bpm' },
      hrvMs: { min: 40, max: 200, label: '≥ 40 ms' },
    },
  },
  {
    phase: 2,
    name: 'First Shift',
    advanceAfterGoodDays: 5,
    windows: {
      // 11:35 PM – 12:25 AM
      bedtime: { min: 23 * 60 + 35, max: 25, label: '11:35 PM – 12:25 AM' },
      wake: { min: 7 * 60 + 25, max: 8 * 60 + 15, label: '7:25 – 8:15 AM' },
      totalSleepHours: { min: 7.2, max: 10.0, label: '≥ 7.2 h' },
      standMinutes: { min: 100, max: 999, label: '≥ 100 min' },
      activeEnergyKcal: { min: 500, max: 9999, label: '≥ 500 kcal' },
      restingHeartRate: { min: 40, max: 80, label: '≤ 80 bpm' },
      hrvMs: { min: 42, max: 200, label: '≥ 42 ms' },
    },
  },
  {
    phase: 3,
    name: 'Steady Climb',
    advanceAfterGoodDays: 6,
    windows: {
      bedtime: { min: 23 * 60 + 20, max: 10, label: '11:20 PM – 12:10 AM' },
      wake: { min: 7 * 60 + 15, max: 8 * 60 + 5, label: '7:15 – 8:05 AM' },
      totalSleepHours: { min: 7.4, max: 10.0, label: '≥ 7.4 h' },
      standMinutes: { min: 110, max: 999, label: '≥ 110 min' },
      activeEnergyKcal: { min: 520, max: 9999, label: '≥ 520 kcal' },
      restingHeartRate: { min: 40, max: 78, label: '≤ 78 bpm' },
      hrvMs: { min: 44, max: 200, label: '≥ 44 ms' },
    },
  },
  {
    phase: 4,
    name: 'Approaching Ideal',
    advanceAfterGoodDays: 7,
    windows: {
      bedtime: { min: 23 * 60 + 5, max: 1439, label: '11:05 PM – 12:00 AM' }, // max = end of day for "before midnight"
      wake: { min: 7 * 60, max: 7 * 60 + 50, label: '7:00 – 7:50 AM' },
      totalSleepHours: { min: 7.6, max: 10.0, label: '≥ 7.6 h' },
      standMinutes: { min: 120, max: 999, label: '≥ 120 min' },
      activeEnergyKcal: { min: 550, max: 9999, label: '≥ 550 kcal' },
      restingHeartRate: { min: 40, max: 75, label: '≤ 75 bpm' },
      hrvMs: { min: 46, max: 200, label: '≥ 46 ms' },
    },
  },
  {
    phase: 5,
    name: 'Locked In',
    advanceAfterGoodDays: 999, // terminal
    windows: {
      bedtime: { min: 22 * 60 + 45, max: 23 * 60 + 15, label: '10:45 – 11:15 PM' },
      wake: { min: 7 * 60 + 15, max: 7 * 60 + 45, label: '7:15 – 7:45 AM' },
      totalSleepHours: { min: 7.5, max: 10.0, label: '≥ 7.5 h' },
      standMinutes: { min: 120, max: 999, label: '≥ 120 min' },
      activeEnergyKcal: { min: 550, max: 9999, label: '≥ 550 kcal' },
      restingHeartRate: { min: 40, max: 72, label: '≤ 72 bpm' },
      hrvMs: { min: 48, max: 200, label: '≥ 48 ms' },
    },
  },
]

// ─── Player progress state ──────────────────────────────────

export interface BaselineProgress {
  currentPhase: number
  /** Consecutive (or recent-window) Good+ days toward next phase */
  goodStreak: number
  /** ISO date of last evaluation */
  lastEvaluatedDate?: string
}

export function createInitialProgress(): BaselineProgress {
  return {
    currentPhase: 1,
    goodStreak: 0,
  }
}

export function getPhase(progress: BaselineProgress): PhaseConfig {
  const p = PHASES.find((x) => x.phase === progress.currentPhase) ?? PHASES[0]
  return p
}

// ─── Scoring against current phase ──────────────────────────

export type HitResult = 'hit' | 'near' | 'miss'

/**
 * Bedtime special-case: window can cross midnight.
 * e.g. min=1430 (11:50 PM), max=40 (12:40 AM).
 * A time is "in window" if >= min OR <= max when max < min.
 */
export function isTimeInWindow(
  minutesFromMidnight: number,
  window: PhaseWindow
): boolean {
  const { min, max } = window
  if (max >= min) {
    // normal non-wrapping window (e.g. wake 7:40–8:30)
    return minutesFromMidnight >= min && minutesFromMidnight <= max
  }
  // wrapping window (bedtime across midnight)
  return minutesFromMidnight >= min || minutesFromMidnight <= max
}

export function scoreMetric(
  key: MetricKey,
  value: number,
  progress: BaselineProgress
): HitResult {
  const phase = getPhase(progress)
  const window = phase.windows[key]
  if (!window) return 'near'

  if (key === 'bedtime' || key === 'wake') {
    if (isTimeInWindow(value, window)) return 'hit'
    // near = within 20 minutes of either edge
    const distToMin = Math.min(
      Math.abs(value - window.min),
      Math.abs(value + 1440 - window.min),
      Math.abs(value - window.min - 1440)
    )
    const distToMax = Math.min(
      Math.abs(value - window.max),
      Math.abs(value + 1440 - window.max),
      Math.abs(value - window.max - 1440)
    )
    const nearest = Math.min(distToMin, distToMax)
    if (nearest <= 20) return 'near'
    return 'miss'
  }

  // Higher-is-better or lower-is-better simple bounds
  const baseline = OBSERVED_BASELINES[key]
  if (baseline.improveDirection === 'higher') {
    if (value >= window.min) return 'hit'
    if (value >= window.min * 0.9) return 'near'
    return 'miss'
  }
  if (baseline.improveDirection === 'lower') {
    if (value <= window.max) return 'hit'
    if (value <= window.max * 1.1) return 'near'
    return 'miss'
  }
  // earlier/later already handled by time windows
  return 'near'
}

export type DailyTier = 'Excellent' | 'Good' | 'Neutral' | 'Poor' | 'Bad'

/**
 * Aggregate a night/day into a tier using personal phase windows.
 * Sleep timing + duration are primary; recovery signals are secondary modifiers.
 */
export function scorePersonalDay(
  input: {
    bedtimeMinutes?: number
    wakeMinutes?: number
    totalSleepHours?: number
    standMinutes?: number
    activeEnergyKcal?: number
    restingHeartRate?: number
    hrvMs?: number
  },
  progress: BaselineProgress
): {
  tier: DailyTier
  hits: Partial<Record<MetricKey, HitResult>>
  summary: string
} {
  const hits: Partial<Record<MetricKey, HitResult>> = {}

  if (input.bedtimeMinutes != null) {
    hits.bedtime = scoreMetric('bedtime', input.bedtimeMinutes, progress)
  }
  if (input.wakeMinutes != null) {
    hits.wake = scoreMetric('wake', input.wakeMinutes, progress)
  }
  if (input.totalSleepHours != null) {
    hits.totalSleepHours = scoreMetric(
      'totalSleepHours',
      input.totalSleepHours,
      progress
    )
  }
  if (input.standMinutes != null) {
    hits.standMinutes = scoreMetric('standMinutes', input.standMinutes, progress)
  }
  if (input.activeEnergyKcal != null) {
    hits.activeEnergyKcal = scoreMetric(
      'activeEnergyKcal',
      input.activeEnergyKcal,
      progress
    )
  }
  if (input.restingHeartRate != null) {
    hits.restingHeartRate = scoreMetric(
      'restingHeartRate',
      input.restingHeartRate,
      progress
    )
  }
  if (input.hrvMs != null) {
    hits.hrvMs = scoreMetric('hrvMs', input.hrvMs, progress)
  }

  // Primary weight: bedtime, wake, total sleep
  const primary = [hits.bedtime, hits.wake, hits.totalSleepHours].filter(Boolean)
  const primaryHits = primary.filter((h) => h === 'hit').length
  const primaryMisses = primary.filter((h) => h === 'miss').length

  let tier: DailyTier = 'Neutral'
  if (primary.length >= 2) {
    if (primaryHits === primary.length) tier = 'Excellent'
    else if (primaryHits >= 2 || (primaryHits === 1 && primaryMisses === 0))
      tier = 'Good'
    else if (primaryMisses >= 2) tier = 'Poor'
    else if (primaryMisses >= 1) tier = 'Neutral'
  }

  // Recovery modifiers: strong RHR/HRV can bump Neutral→Good or soften Poor
  const recoveryHits = [hits.restingHeartRate, hits.hrvMs].filter(
    (h) => h === 'hit'
  ).length
  if (tier === 'Neutral' && recoveryHits === 2) tier = 'Good'
  if (tier === 'Poor' && recoveryHits === 2) tier = 'Neutral'
  if (tier === 'Good' && primaryHits === primary.length && recoveryHits >= 1)
    tier = 'Excellent'

  // Catastrophic sleep duration override
  if (input.totalSleepHours != null && input.totalSleepHours < 5) {
    tier = 'Bad'
  }

  const phase = getPhase(progress)
  const summary = `Phase ${phase.phase} (${phase.name}): ${tier}`

  return { tier, hits, summary }
}

/**
 * After scoring a day, update streak and possibly advance phase.
 * Only call with finalized days.
 */
export function advanceProgress(
  progress: BaselineProgress,
  tier: DailyTier,
  evaluatedDate: string
): BaselineProgress {
  const phase = getPhase(progress)
  const isGood = tier === 'Good' || tier === 'Excellent'

  let goodStreak = isGood ? progress.goodStreak + 1 : 0
  let currentPhase = progress.currentPhase

  if (goodStreak >= phase.advanceAfterGoodDays && currentPhase < PHASES.length) {
    currentPhase = Math.min(currentPhase + 1, PHASES.length)
    goodStreak = 0
  }

  return {
    currentPhase,
    goodStreak,
    lastEvaluatedDate: evaluatedDate,
  }
}

/** Effects table — same shape as rhythm-from-export so Trust wiring stays simple */
export const PERSONAL_TIER_EFFECTS: Record<
  DailyTier,
  {
    rewardEfficiency: number
    tokenMultiplier: number
    shadowDebtDelta: number
    leaderTrustDelta: number
  }
> = {
  Excellent: {
    rewardEfficiency: 1.15,
    tokenMultiplier: 1.25,
    shadowDebtDelta: -2,
    leaderTrustDelta: 3,
  },
  Good: {
    rewardEfficiency: 1.05,
    tokenMultiplier: 1.0,
    shadowDebtDelta: -1,
    leaderTrustDelta: 1,
  },
  Neutral: {
    rewardEfficiency: 1.0,
    tokenMultiplier: 0.5,
    shadowDebtDelta: 0,
    leaderTrustDelta: 0,
  },
  Poor: {
    rewardEfficiency: 0.85,
    tokenMultiplier: 0.25,
    shadowDebtDelta: 3,
    leaderTrustDelta: -4,
  },
  Bad: {
    rewardEfficiency: 0.7,
    tokenMultiplier: 0.0,
    shadowDebtDelta: 7,
    leaderTrustDelta: -8,
  },
}
