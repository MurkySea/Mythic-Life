/**
 * Mythic Life – Rhythm from Health Auto Export
 *
 * Ported from mythic_life_data (locked rules 2026-07-23 / 2026-07-25).
 *
 * Targets:
 *   Bedtime window  22:45 – 23:15  (aim ~11:00 PM)
 *   Wake window     07:15 – 07:45  (aim ~7:30 AM)
 *
 * Tier is driven by max deviation from either window.
 * Effects feed Leader Trust, Shadow Debt, token multiplier, reward efficiency.
 */

export type DailyTier = 'Excellent' | 'Good' | 'Neutral' | 'Poor' | 'Bad'

export interface SleepWindows {
  targetBedtimeStart: string // HH:mm
  targetBedtimeEnd: string
  targetWakeStart: string
  targetWakeEnd: string
}

export const DEFAULT_WINDOWS: SleepWindows = {
  targetBedtimeStart: '22:45',
  targetBedtimeEnd: '23:15',
  targetWakeStart: '07:15',
  targetWakeEnd: '07:45',
}

export const TIER_EFFECTS: Record<
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

// ─── Time helpers ───────────────────────────────────────────

export function parseTimeToMinutes(time: string): number {
  let timePart = time

  if (time.includes('T')) {
    timePart = time.split('T')[1].slice(0, 5)
  } else if (time.includes(' ')) {
    const parts = time.split(' ')
    timePart = parts[1] ? parts[1].slice(0, 5) : time.slice(0, 5)
  } else {
    timePart = time.slice(0, 5)
  }

  const [h, m] = timePart.split(':').map(Number)
  return (((h || 0) * 60 + (m || 0)) % 1440 + 1440) % 1440
}

export function getDeviationMinutes(
  actual: string,
  windowStart: string,
  windowEnd: string
): number {
  const actualMin = parseTimeToMinutes(actual)
  const start = parseTimeToMinutes(windowStart)
  const end = parseTimeToMinutes(windowEnd)

  if (actualMin >= start && actualMin <= end) return 0
  if (actualMin < start) return start - actualMin
  return actualMin - end
}

export function contributionToTier(contribution: number): DailyTier {
  if (contribution >= 12) return 'Excellent'
  if (contribution >= 7) return 'Good'
  if (contribution >= 0) return 'Neutral'
  if (contribution >= -4) return 'Poor'
  return 'Bad'
}

export function calculateRhythm(
  bedtime: string,
  wakeTime: string,
  windows: SleepWindows = DEFAULT_WINDOWS
) {
  const bedDev = getDeviationMinutes(
    bedtime,
    windows.targetBedtimeStart,
    windows.targetBedtimeEnd
  )
  const wakeDev = getDeviationMinutes(
    wakeTime,
    windows.targetWakeStart,
    windows.targetWakeEnd
  )
  const maxDev = Math.max(bedDev, wakeDev)

  let contribution = 0
  if (bedDev === 0 && wakeDev === 0) contribution = 12
  else if (maxDev <= 20) contribution = 7
  else if (maxDev <= 45) contribution = 2
  else if (maxDev <= 90) contribution = -4
  else contribution = -9

  const tier = contributionToTier(contribution)
  const effects = TIER_EFFECTS[tier]

  return {
    contribution,
    tier,
    bedDeviationMinutes: bedDev,
    wakeDeviationMinutes: wakeDev,
    maxDeviationMinutes: maxDev,
    ...effects,
  }
}

// ─── Health Auto Export payload extraction ──────────────────

export interface ExtractedSleep {
  bedtime: string
  wakeTime: string
  totalSleepHours: number | null
  deep: number | null
  rem: number | null
  core: number | null
  awake: number | null
  date: string | null
}

export function extractSleep(metrics: any[]): ExtractedSleep | null {
  const sleepMetric = metrics.find((m: any) => m.name === 'sleep_analysis')
  if (!sleepMetric?.data?.length) return null

  const session = sleepMetric.data[sleepMetric.data.length - 1]
  return {
    bedtime: session.sleepStart || session.inBedStart,
    wakeTime: session.sleepEnd || session.inBedEnd,
    totalSleepHours: session.totalSleep ?? null,
    deep: session.deep ?? null,
    rem: session.rem ?? null,
    core: session.core ?? null,
    awake: session.awake ?? null,
    date: session.date?.slice(0, 10) ?? null,
  }
}

export function extractNumber(metrics: any[], name: string): number | null {
  const metric = metrics.find((m: any) => m.name === name)
  if (!metric?.data?.length) return null
  const last = metric.data[metric.data.length - 1]
  return typeof last.qty === 'number' ? last.qty : null
}

export function formatTimeForDisplay(raw: string): string {
  try {
    const minutes = parseTimeToMinutes(raw)
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const period = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
  } catch {
    return raw
  }
}

export type StressProxy = 'low' | 'moderate' | 'high' | 'unknown'
export type RecoveryProxy = 'good' | 'fair' | 'poor' | 'unknown'

export function stressFromHrv(hrv: number | null): StressProxy {
  if (hrv === null) return 'unknown'
  if (hrv < 30) return 'high'
  if (hrv < 45) return 'moderate'
  return 'low'
}

export function recoveryFromSignals(
  hrv: number | null,
  restingHR: number | null
): RecoveryProxy {
  if (hrv === null || restingHR === null) return 'unknown'
  if (hrv >= 45 && restingHR < 65) return 'good'
  if (hrv < 35 || restingHR > 75) return 'poor'
  return 'fair'
}

/** Full result shape produced from a Health Auto Export payload */
export interface RhythmExportResult {
  success: true
  date: string | null
  sleep: {
    bedtime: string
    wakeTime: string
    bedtimeDisplay: string
    wakeDisplay: string
    totalHours: number | null
    deep: number | null
    rem: number | null
    core: number | null
  }
  rhythm: {
    tier: DailyTier
    contribution: number
    bedDeviationMinutes: number
    wakeDeviationMinutes: number
    rewardEfficiency: number
    consistencyTokenMultiplier: number
    shadowDebtDelta: number
    leaderTrustDelta: number
  }
  signals: {
    stressProxy: StressProxy
    recoveryProxy: RecoveryProxy
    hrv: number | null
    restingHeartRate: number | null
    steps: number | null
    activeEnergyKcal: number | null
  }
  targets: { bedtime: string; wake: string }
  message: string
}

/**
 * Process a raw Health Auto Export body into a full Rhythm result.
 * Returns null if no usable sleep session is present.
 */
export function processHealthExportPayload(body: any): RhythmExportResult | null {
  const metrics = body?.data?.metrics || []
  const sleep = extractSleep(metrics)
  if (!sleep?.bedtime || !sleep?.wakeTime) return null

  const hrv = extractNumber(metrics, 'heart_rate_variability')
  const restingHR = extractNumber(metrics, 'resting_heart_rate')
  const steps = extractNumber(metrics, 'step_count')
  const activeEnergy = extractNumber(metrics, 'active_energy')

  const rhythm = calculateRhythm(sleep.bedtime, sleep.wakeTime)

  return {
    success: true,
    date: sleep.date,
    sleep: {
      bedtime: sleep.bedtime,
      wakeTime: sleep.wakeTime,
      bedtimeDisplay: formatTimeForDisplay(sleep.bedtime),
      wakeDisplay: formatTimeForDisplay(sleep.wakeTime),
      totalHours:
        sleep.totalSleepHours != null
          ? Number(Number(sleep.totalSleepHours).toFixed(2))
          : null,
      deep: sleep.deep,
      rem: sleep.rem,
      core: sleep.core,
    },
    rhythm: {
      tier: rhythm.tier,
      contribution: rhythm.contribution,
      bedDeviationMinutes: rhythm.bedDeviationMinutes,
      wakeDeviationMinutes: rhythm.wakeDeviationMinutes,
      rewardEfficiency: rhythm.rewardEfficiency,
      consistencyTokenMultiplier: rhythm.tokenMultiplier,
      shadowDebtDelta: rhythm.shadowDebtDelta,
      leaderTrustDelta: rhythm.leaderTrustDelta,
    },
    signals: {
      stressProxy: stressFromHrv(hrv),
      recoveryProxy: recoveryFromSignals(hrv, restingHR),
      hrv,
      restingHeartRate: restingHR,
      steps,
      activeEnergyKcal: activeEnergy,
    },
    targets: {
      bedtime: '11:00 PM',
      wake: '7:30 AM',
    },
    message: `Rhythm Tier: ${rhythm.tier} | Leader Trust Δ: ${rhythm.leaderTrustDelta}`,
  }
}

/** Map DailyTier → relationship RhythmTier vocabulary */
export function dailyTierToRhythmTier(
  tier: DailyTier
): 'Excellent' | 'Good' | 'Neutral' | 'Poor' | 'Bad' {
  return tier
}
