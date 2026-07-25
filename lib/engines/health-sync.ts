/**
 * Mythic Life – Health Data Sync + Rhythm Day → Tier bridge
 *
 * Policy (finalized 2026-07-25):
 * - Cadence: every 12 hours
 * - Query model: incremental “from last sync”
 * - Bootstrap: last 7 days when no prior successful sync exists
 * - Safety cap: never look back more than 30 days in a single query
 * - Idempotent upsert by sample ID
 * - Cursor (lastSuccessfulSync) advances only after a successful write + engine processing
 * - Nights stay provisional until a clean wake is observed or the hard cutoff (14:00 local)
 * - Finalized nights are mapped to RhythmTier so they can drive Trust / Patience / Companions
 *
 * Pure functions only. Side-effect boundaries (HealthKit / export query, persistence,
 * companion Trust updates) live outside this module.
 */

import type { RhythmTier } from './relationship'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HealthSyncState {
  /** ISO timestamp of the last fully successful sync, or null */
  lastSuccessfulSync: string | null
  /** ISO timestamp of the most recent attempt (success or failure) */
  lastAttempt: string | null
  consecutiveFailures: number
  lastSource?: string
}

export type SleepValue =
  | 'INBED'
  | 'ASLEEP'
  | 'AWAKE'
  | 'CORE'
  | 'DEEP'
  | 'REM'
  | 'UNKNOWN'

export interface SleepSample {
  id: string
  startDate: string // ISO
  endDate: string // ISO
  value: SleepValue
  sourceName?: string
  sourceId?: string
  processed?: boolean
}

export interface HealthSyncResult {
  success: boolean
  samplesFetched: number
  samplesUpserted: number
  newLastSuccessfulSync: string | null
  error?: string
  usedBootstrapWindow: boolean
}

export type DayStatus = 'provisional' | 'finalized' | 'missing' | 'manual'

export interface RhythmDay {
  /** Local calendar date YYYY-MM-DD */
  date: string
  status: DayStatus
  bedtime?: string
  wakeTime?: string
  totalSleepMinutes?: number
  inBedMinutes?: number
  notes?: string
}

export interface RhythmScoreConfig {
  /** Local hour (0-23) after which a provisional night is force-finalized */
  hardCutoffHour: number
  /** Days of history to pull on first sync / missing cursor */
  bootstrapDays: number
  /** Target sync interval in hours */
  syncIntervalHours: number
  /**
   * Ideal sleep duration window in minutes (used by rhythmDayToTier).
   * Default targets a healthy adult range.
   */
  idealSleepMinutes: { min: number; max: number }
}

export const DEFAULT_RHYTHM_CONFIG: RhythmScoreConfig = {
  hardCutoffHour: 14,
  bootstrapDays: 7,
  syncIntervalHours: 12,
  idealSleepMinutes: { min: 390, max: 540 }, // 6.5h – 9h
}

// ─── Query window & scheduling ──────────────────────────────────────────────

/**
 * Compute the query window for the next pull.
 */
export function computeQueryWindow(
  state: HealthSyncState,
  now: Date = new Date(),
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): { start: Date; end: Date; usedBootstrap: boolean } {
  const end = now

  if (state.lastSuccessfulSync) {
    const start = new Date(state.lastSuccessfulSync)
    // Safety: never query more than ~30 days even if last sync is ancient
    const maxLookback = new Date(now)
    maxLookback.setDate(maxLookback.getDate() - 30)
    const safeStart = start < maxLookback ? maxLookback : start
    return { start: safeStart, end, usedBootstrap: false }
  }

  // First sync / no prior successful timestamp → bootstrap window
  const start = new Date(now)
  start.setDate(start.getDate() - config.bootstrapDays)
  return { start, end, usedBootstrap: true }
}

/**
 * Decide whether a scheduled sync should run right now.
 */
export function shouldRunSync(
  state: HealthSyncState,
  now: Date = new Date(),
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): boolean {
  if (!state.lastAttempt) return true
  const last = new Date(state.lastAttempt)
  const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60)
  return hoursSince >= config.syncIntervalHours
}

/**
 * Advance the cursor only after a successful write + engine notification.
 */
export function advanceSuccessfulSync(
  prev: HealthSyncState,
  syncCompletedAt: Date = new Date()
): HealthSyncState {
  return {
    ...prev,
    lastSuccessfulSync: syncCompletedAt.toISOString(),
    lastAttempt: syncCompletedAt.toISOString(),
    consecutiveFailures: 0,
  }
}

/**
 * Record a failed attempt (does not move the success cursor).
 */
export function recordFailedAttempt(
  prev: HealthSyncState,
  attemptedAt: Date = new Date()
): HealthSyncState {
  return {
    ...prev,
    lastAttempt: attemptedAt.toISOString(),
    consecutiveFailures: prev.consecutiveFailures + 1,
  }
}

/**
 * Simple exponential backoff in minutes (capped).
 */
export function backoffMinutes(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0
  // 15 → 30 → 60 → 120 → cap 240
  const base = 15 * Math.pow(2, consecutiveFailures - 1)
  return Math.min(base, 240)
}

/**
 * Pure description of what the next sync job should do.
 */
export function planSync(
  state: HealthSyncState,
  now: Date = new Date(),
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): {
  shouldRun: boolean
  window: { start: Date; end: Date; usedBootstrap: boolean } | null
  backoffMinutes: number
} {
  const should = shouldRunSync(state, now, config)
  if (!should) {
    return {
      shouldRun: false,
      window: null,
      backoffMinutes: backoffMinutes(state.consecutiveFailures),
    }
  }

  const window = computeQueryWindow(state, now, config)
  return {
    shouldRun: true,
    window,
    backoffMinutes: 0,
  }
}

// ─── Night status / RhythmDay construction ──────────────────────────────────

/**
 * Decide whether a night can be finalized or must stay provisional.
 */
export function evaluateNightStatus(
  samples: SleepSample[],
  _localDate: string,
  now: Date,
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): DayStatus {
  if (samples.length === 0) return 'missing'

  const hasAsleep = samples.some((s) =>
    ['ASLEEP', 'CORE', 'DEEP', 'REM'].includes(s.value)
  )
  if (!hasAsleep) return 'missing'

  const localHour = now.getHours() // caller should pass a locally-zoned Date
  if (localHour >= config.hardCutoffHour) return 'finalized'

  return 'provisional'
}

/**
 * Group samples by local calendar date (YYYY-MM-DD).
 * Caller supplies the timezone-aware date extractor.
 */
export function groupSamplesByLocalDate(
  samples: SleepSample[],
  getLocalDate: (iso: string) => string
): Map<string, SleepSample[]> {
  const map = new Map<string, SleepSample[]>()
  for (const s of samples) {
    const dateKey = getLocalDate(s.startDate)
    const list = map.get(dateKey) ?? []
    list.push(s)
    map.set(dateKey, list)
  }
  return map
}

/**
 * Build a RhythmDay from samples for one local calendar date.
 */
export function buildRhythmDay(
  localDate: string,
  samples: SleepSample[],
  now: Date,
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): RhythmDay {
  const status = evaluateNightStatus(samples, localDate, now, config)

  if (status === 'missing') {
    return { date: localDate, status: 'missing' }
  }

  const sorted = [...samples].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  )

  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  let totalSleepMinutes = 0
  for (const s of sorted) {
    if (['ASLEEP', 'CORE', 'DEEP', 'REM'].includes(s.value)) {
      const mins =
        (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) /
        (1000 * 60)
      totalSleepMinutes += mins
    }
  }

  return {
    date: localDate,
    status,
    bedtime: first?.startDate,
    wakeTime: last?.endDate,
    totalSleepMinutes: Math.round(totalSleepMinutes),
  }
}

/**
 * Main entry after a successful “from last sync” pull:
 * turn new samples into RhythmDay updates.
 */
export function processNewSamples(
  samples: SleepSample[],
  now: Date,
  getLocalDate: (iso: string) => string,
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): RhythmDay[] {
  const byDate = groupSamplesByLocalDate(samples, getLocalDate)
  const days: RhythmDay[] = []

  for (const [date, daySamples] of byDate) {
    days.push(buildRhythmDay(date, daySamples, now, config))
  }

  return days
}

// ─── RhythmDay → RhythmTier bridge ─────────────────────────────────────────

/**
 * Map a finalized RhythmDay to the RhythmTier vocabulary used by
 * relationship.ts (updateTrustWithPatience, consecutiveBadDays, etc.).
 *
 * Design notes:
 * - Only finalized (or manual) days should be passed in.
 * - Provisional days must never affect Trust or companion reactions.
 * - Duration is the primary signal for now. Bedtime consistency can be layered
 *   later once we keep a short rolling history of bedtimes.
 *
 * Thresholds (tunable via config.idealSleepMinutes):
 *   Excellent  ≥ ideal max          (very solid night)
 *   Good       inside ideal window
 *   Neutral    slightly short or slightly long
 *   Poor       noticeably short
 *   Bad        severely short or almost none
 */
export function rhythmDayToTier(
  day: RhythmDay,
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): RhythmTier {
  // Guard: never score provisional or missing nights
  if (day.status === 'provisional' || day.status === 'missing') {
    return 'Neutral' // safe no-op default; caller should filter these out
  }

  const mins = day.totalSleepMinutes ?? 0
  const { min, max } = config.idealSleepMinutes

  if (mins >= max) return 'Excellent'
  if (mins >= min) return 'Good'
  if (mins >= min - 60) return 'Neutral' // up to 1 h short
  if (mins >= min - 120) return 'Poor' // 1–2 h short
  return 'Bad'
}

/**
 * Convenience: take a batch of RhythmDays and return only the ones that
 * are safe to feed into Trust / companion systems, already mapped to tiers.
 */
export function finalizedTiersFromDays(
  days: RhythmDay[],
  config: RhythmScoreConfig = DEFAULT_RHYTHM_CONFIG
): { date: string; tier: RhythmTier; day: RhythmDay }[] {
  return days
    .filter((d) => d.status === 'finalized' || d.status === 'manual')
    .map((d) => ({
      date: d.date,
      tier: rhythmDayToTier(d, config),
      day: d,
    }))
}
