/**
 * Mythic Life – Rhythm from Health Auto Export
 *
 * Ported from mythic_life_data (locked rules 2026-07-23 / 2026-07-25).
 * Session selection fixed 2026-07-26: do not treat a morning re-sleep
 * segment as the night's bedtime.
 * Live-day date fixed 2026-07-27: date = local date of wakeTime
 * (America/Chicago) so mornings feel live.
 * Most-recent overnight fixed 2026-07-27: prefer newest wake-day, not longest overall.
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

/**
 * Circular deviation from a target window on a 24h clock.
 * Handles midnight wrap (e.g. 00:30 vs 23:00 window).
 */
export function getDeviationMinutes(
  actual: string,
  windowStart: string,
  windowEnd: string
): number {
  const actualMin = parseTimeToMinutes(actual)
  const start = parseTimeToMinutes(windowStart)
  const end = parseTimeToMinutes(windowEnd)

  if (start <= end) {
    if (actualMin >= start && actualMin <= end) return 0
    const distStart = Math.min(
      Math.abs(actualMin - start),
      1440 - Math.abs(actualMin - start)
    )
    const distEnd = Math.min(
      Math.abs(actualMin - end),
      1440 - Math.abs(actualMin - end)
    )
    return Math.min(distStart, distEnd)
  }

  if (actualMin >= start || actualMin <= end) return 0
  const distStart = Math.min(
    Math.abs(actualMin - start),
    1440 - Math.abs(actualMin - start)
  )
  const distEnd = Math.min(
    Math.abs(actualMin - end),
    1440 - Math.abs(actualMin - end)
  )
  return Math.min(distStart, distEnd)
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
  /** Local YYYY-MM-DD of the wake (live day) */
  date: string | null
}

interface RawSession {
  sleepStart?: string
  inBedStart?: string
  sleepEnd?: string
  inBedEnd?: string
  totalSleep?: number
  deep?: number
  rem?: number
  core?: number
  awake?: number
  date?: string
}

function sessionStartIso(s: RawSession): string | null {
  return s.sleepStart || s.inBedStart || null
}

function sessionEndIso(s: RawSession): string | null {
  return s.sleepEnd || s.inBedEnd || null
}

function sessionDurationHours(s: RawSession): number {
  if (typeof s.totalSleep === 'number' && s.totalSleep > 0) return s.totalSleep
  const a = sessionStartIso(s)
  const b = sessionEndIso(s)
  if (!a || !b) return 0
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return ms > 0 ? ms / (1000 * 60 * 60) : 0
}

function localHourFromIso(iso: string): number {
  try {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) {
      const h = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chicago',
          hour: 'numeric',
          hour12: false,
        }).format(d),
        10
      )
      return h
    }
  } catch {
    /* fall through */
  }
  return parseTimeToMinutes(iso) / 60
}

function localDateFromIso(iso: string): string | null {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return null
  }
}

/**
 * Pick the primary overnight session for "today".
 *
 * Rules (2026-07-27):
 * 1. Prefer the *most recent* session by end time.
 * 2. Prefer true overnight starts (hour >= 19 or hour < 4).
 * 3. Among candidates that share the same wake-day, take the longest.
 * 4. Reject short morning-only re-sleeps when a real overnight exists.
 */
export function pickPrimarySleepSession(sessions: RawSession[]): RawSession | null {
  if (!sessions.length) return null

  type Scored = {
    s: RawSession
    start: string
    end: string
    hours: number
    endMs: number
    startHour: number
    isOvernightStart: boolean
    isMorningOnly: boolean
    wakeDate: string | null
  }

  const scored = sessions
    .map((s) => {
      const start = sessionStartIso(s)
      const end = sessionEndIso(s)
      const hours = sessionDurationHours(s)
      if (!start || !end || hours <= 0) return null
      const startHour = localHourFromIso(start)
      const isOvernightStart = startHour >= 19 || startHour < 4
      const isMorningOnly = startHour >= 4 && startHour < 12 && hours < 3
      const endMs = new Date(end).getTime()
      const wakeDate = localDateFromIso(end)
      return { s, start, end, hours, endMs, startHour, isOvernightStart, isMorningOnly, wakeDate }
    })
    .filter(Boolean) as Scored[]

  if (!scored.length) return sessions[sessions.length - 1] || null

  scored.sort((a, b) => b.endMs - a.endMs)

  const byWake = new Map<string, Scored[]>()
  for (const row of scored) {
    const key = row.wakeDate || 'unknown'
    const list = byWake.get(key) ?? []
    list.push(row)
    byWake.set(key, list)
  }

  const wakeDates = [...byWake.keys()].sort((a, b) => {
    if (a === 'unknown') return 1
    if (b === 'unknown') return -1
    return b.localeCompare(a)
  })

  for (const wakeDate of wakeDates) {
    const group = byWake.get(wakeDate)!

    const overnight = group.filter((x) => x.isOvernightStart && !x.isMorningOnly)
    if (overnight.length) {
      overnight.sort((a, b) => b.hours - a.hours)
      return overnight[0].s
    }

    const substantial = group.filter((x) => x.hours >= 2 && !x.isMorningOnly)
    const pool = substantial.length ? substantial : group
    pool.sort((a, b) => b.hours - a.hours)
    return pool[0].s
  }

  return scored[0].s
}

export function extractSleep(metrics: any[]): ExtractedSleep | null {
  const sleepMetric = metrics.find((m: any) => m.name === 'sleep_analysis')
  if (!sleepMetric?.data?.length) return null

  const sessions = sleepMetric.data as RawSession[]
  const session = pickPrimarySleepSession(sessions)
  if (!session) return null

  const bedtime = sessionStartIso(session)
  const wakeTime = sessionEndIso(session)
  if (!bedtime || !wakeTime) return null

  const date = localDateFromIso(wakeTime)

  return {
    bedtime,
    wakeTime,
    totalSleepHours: session.totalSleep ?? sessionDurationHours(session) ?? null,
    deep: session.deep ?? null,
    rem: session.rem ?? null,
    core: session.core ?? null,
    awake: session.awake ?? null,
    date,
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

export function dailyTierToRhythmTier(
  tier: DailyTier
): 'Excellent' | 'Good' | 'Neutral' | 'Poor' | 'Bad' {
  return tier
}
