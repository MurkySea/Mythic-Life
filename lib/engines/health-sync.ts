/**
 * Mythic Life – Health Data Sync (Rhythm feed)
 *
 * Policy (2026-07-25):
 * - Cadence: every 12 hours
 * - Query model: incremental “from last sync”
 * - Bootstrap: last 7 days when no prior successful sync exists
 * - Safety cap: never look back more than 30 days in a single query
 * - Idempotent upsert by sample ID
 * - Cursor (lastSuccessfulSync) advances only after a successful write + engine processing
 * - Nights stay provisional until a clean wake is observed or the hard cutoff (14:00 local) is reached
 *
 * Pure functions only. Side-effect boundaries (HealthKit / export query, persistence)
 * live outside this module.
 */

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
  endDate: string   // ISO
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
}

export const DEFAULT_RHYTHM_CONFIG: RhythmScoreConfig = {
  hardCutoffHour: 14,
  bootstrapDays: 7,
  syncIntervalHours: 12,
}

// ─── Query window & scheduling ──────────────────────────────────────────────

/**
 * Compute the query window for the next pull.
 * Returns { start, end, usedBootstrap }
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
 * Useful for the background scheduler.
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
 *
 * Rules:
 * - No sleep samples → missing
 * - Past hardCutoffHour → force finalize
 * - Otherwise stay provisional until a later sync sees a clean wake
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
