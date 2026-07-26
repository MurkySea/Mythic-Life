/**
 * Mythic Life – Vacation / Recovery / Ramp Mode
 * Pure functions. Other engines consult these helpers.
 *
 * Design finalized 2026-07-25.
 */

export type SystemMode = 'normal' | 'vacation' | 'recovery' | 'ramp'

export interface ModeState {
  mode: SystemMode
  /** ISO date string when the current mode started */
  startedAt: string | null
  /** Optional planned end (ISO) */
  endsAt: string | null
  /** Consecutive full calendar days spent in vacation or recovery */
  consecutiveRestDays: number
  /** Whether a Rested Buff is active after exiting a qualifying vacation */
  hasRestedBuff: boolean
  /** Days remaining on the Rested Buff */
  restedBuffDaysRemaining: number
}

export interface VacationQuest {
  id: string
  title: string
  description: string
  tokenReward: number
  category: 'shared' | 'body' | 'joy' | 'maintenance'
  completed: boolean
}

export interface VacationConfig {
  /** Fraction of existing Shadow Debt to decay per full rest day (0–1) */
  debtDecayRate: number
  /** Minimum consecutive vacation days required for full Rested Buff */
  minDaysForFullRestedBuff: number
  /** Length of the soft re-entry Ramp window in days */
  rampDurationDays: number
  /** How long the Rested Buff lasts after a qualifying exit */
  restedBuffDurationDays: number
  /** Positive Leader Trust drift applied each rest day */
  trustDriftPerRestDay: number
  /** Token multiplier while Rested Buff is active */
  restedBuffTokenMultiplier: number
  /** Default light quests offered during vacation/recovery */
  defaultQuests: Omit<VacationQuest, 'completed'>[]
}

export const DEFAULT_VACATION_CONFIG: VacationConfig = {
  debtDecayRate: 0.07,
  minDaysForFullRestedBuff: 4,
  rampDurationDays: 3,
  restedBuffDurationDays: 6,
  trustDriftPerRestDay: 1.5,
  restedBuffTokenMultiplier: 1.25,
  defaultQuests: [
    {
      id: 'shared-experience',
      title: 'Shared Experience',
      description:
        'Capture one genuine shared moment with Lauren (photo, short note, or memory stamp).',
      tokenReward: 8,
      category: 'shared',
    },
    {
      id: 'body-reset',
      title: 'Body Reset',
      description:
        'One deliberate restoring action: long walk, real rest, fishing, or anything that actually restores you.',
      tokenReward: 6,
      category: 'body',
    },
    {
      id: 'pure-joy',
      title: 'Pure Joy',
      description: 'One action done purely for enjoyment with zero productive justification.',
      tokenReward: 5,
      category: 'joy',
    },
  ],
}

// ──────────────────────────────────────────────
// Query helpers (safe for any engine to call)
// ──────────────────────────────────────────────

export function isRestMode(mode: SystemMode): boolean {
  return mode === 'vacation' || mode === 'recovery'
}

export function shouldFreezeRhythm(mode: SystemMode): boolean {
  return isRestMode(mode)
}

export function shouldAccrueShadowDebt(mode: SystemMode): boolean {
  return mode === 'normal' // ramp still accrues but at reduced rate – handled by caller
}

export function shouldApplySleepPenalty(mode: SystemMode): boolean {
  return !isRestMode(mode)
}

export function shadowDebtMultiplier(mode: SystemMode): number {
  if (mode === 'ramp') return 0.4
  if (isRestMode(mode)) return 0
  return 1
}

export function tokenMultiplier(
  state: ModeState,
  config: VacationConfig = DEFAULT_VACATION_CONFIG
): number {
  return state.hasRestedBuff ? config.restedBuffTokenMultiplier : 1
}

// ──────────────────────────────────────────────
// State transitions (pure)
// ──────────────────────────────────────────────

export function createInitialModeState(): ModeState {
  return {
    mode: 'normal',
    startedAt: null,
    endsAt: null,
    consecutiveRestDays: 0,
    hasRestedBuff: false,
    restedBuffDaysRemaining: 0,
  }
}

/**
 * Enter Vacation Mode.
 * Caller is responsible for freezing any downstream systems
 * (Rhythm scoring, Shadow Debt accrual, Companion Trust penalties).
 */
export function enterVacation(
  prev: ModeState,
  endsAt?: string,
  config: VacationConfig = DEFAULT_VACATION_CONFIG
): { mode: ModeState; quests: VacationQuest[] } {
  return {
    mode: {
      mode: 'vacation',
      startedAt: new Date().toISOString(),
      endsAt: endsAt ?? null,
      consecutiveRestDays: 0,
      hasRestedBuff: false,
      restedBuffDaysRemaining: 0,
    },
    quests: config.defaultQuests.map((q) => ({ ...q, completed: false })),
  }
}

/**
 * Enter Recovery Mode (sick day / forced rest).
 * Same protections, but does not qualify for full Rested Buff.
 */
export function enterRecovery(
  prev: ModeState,
  config: VacationConfig = DEFAULT_VACATION_CONFIG
): { mode: ModeState; quests: VacationQuest[] } {
  return {
    mode: {
      mode: 'recovery',
      startedAt: new Date().toISOString(),
      endsAt: null,
      consecutiveRestDays: 0,
      hasRestedBuff: false,
      restedBuffDaysRemaining: 0,
    },
    quests: config.defaultQuests.map((q) => ({ ...q, completed: false })),
  }
}

/**
 * Exit the current rest mode.
 * Returns the new ModeState (always enters 'ramp') plus whether
 * a full Rested Buff was earned.
 */
export function exitRestMode(
  prev: ModeState,
  config: VacationConfig = DEFAULT_VACATION_CONFIG
): { mode: ModeState; earnedFullBuff: boolean } {
  const earnedFullBuff =
    prev.mode === 'vacation' &&
    prev.consecutiveRestDays >= config.minDaysForFullRestedBuff

  const now = new Date()
  const rampEnd = new Date(
    now.getTime() + config.rampDurationDays * 24 * 60 * 60 * 1000
  )

  return {
    mode: {
      mode: 'ramp',
      startedAt: now.toISOString(),
      endsAt: rampEnd.toISOString(),
      consecutiveRestDays: 0,
      hasRestedBuff: earnedFullBuff,
      restedBuffDaysRemaining: earnedFullBuff
        ? config.restedBuffDurationDays
        : 0,
    },
    earnedFullBuff,
  }
}

/**
 * Advance one calendar day.
 * - Counts consecutive rest days
 * - Decays Shadow Debt (caller applies the returned decay fraction)
 * - Applies positive trust drift (caller applies)
 * - Counts down Ramp and Rested Buff
 * - Auto-transitions Ramp → normal when endsAt is reached
 */
export function advanceDay(
  prev: ModeState,
  config: VacationConfig = DEFAULT_VACATION_CONFIG,
  now: Date = new Date()
): {
  mode: ModeState
  /** Fraction of current Shadow Debt that should be removed today (0 if none) */
  debtDecayFraction: number
  /** Positive trust points to add today */
  trustDrift: number
} {
  const next: ModeState = { ...prev }

  let debtDecayFraction = 0
  let trustDrift = 0

  if (isRestMode(next.mode)) {
    next.consecutiveRestDays += 1
    debtDecayFraction = config.debtDecayRate
    trustDrift = config.trustDriftPerRestDay
  }

  // Ramp countdown
  if (next.mode === 'ramp' && next.endsAt) {
    if (now >= new Date(next.endsAt)) {
      next.mode = 'normal'
      next.startedAt = null
      next.endsAt = null
    }
  }

  // Rested Buff countdown
  if (next.hasRestedBuff && next.restedBuffDaysRemaining > 0) {
    next.restedBuffDaysRemaining -= 1
    if (next.restedBuffDaysRemaining <= 0) {
      next.hasRestedBuff = false
    }
  }

  return { mode: next, debtDecayFraction, trustDrift }
}

/**
 * Mark a vacation quest complete and return the token reward
 * (already multiplied by any active Rested Buff).
 */
export function completeQuest(
  quests: VacationQuest[],
  questId: string,
  modeState: ModeState,
  config: VacationConfig = DEFAULT_VACATION_CONFIG
): { quests: VacationQuest[]; tokensAwarded: number } {
  const idx = quests.findIndex((q) => q.id === questId)
  if (idx === -1 || quests[idx].completed) {
    return { quests, tokensAwarded: 0 }
  }

  const nextQuests = quests.map((q, i) =>
    i === idx ? { ...q, completed: true } : q
  )
  const base = quests[idx].tokenReward
  const tokensAwarded = Math.round(base * tokenMultiplier(modeState, config))

  return { quests: nextQuests, tokensAwarded }
}
