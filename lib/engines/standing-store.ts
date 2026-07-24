/**
 * Persistent player standing
 *
 * Supabase SQL (run once):
 *
 * create table if not exists player_standing (
 *   id text primary key default 'solo',
 *   shadow_debt numeric not null default 0,
 *   consistency_tokens numeric not null default 0,
 *   total_xp numeric not null default 0,
 *   total_gold numeric not null default 0,
 *   last_rhythm_tier text,
 *   last_rhythm_date text,
 *   last_self_neglect text,
 *   updated_at timestamptz default now()
 * );
 *
 * alter table player_standing add column if not exists last_rhythm_date text;
 *
 * insert into player_standing (id) values ('solo') on conflict do nothing;
 */

import { createClient } from '@/utils/supabase/server'

export interface PlayerStandingRow {
  id: string
  shadow_debt: number
  consistency_tokens: number
  total_xp: number
  total_gold: number
  last_rhythm_tier: string | null
  last_rhythm_date: string | null
  last_self_neglect: string | null
  updated_at?: string
}

const DEFAULT: PlayerStandingRow = {
  id: 'solo',
  shadow_debt: 0,
  consistency_tokens: 0,
  total_xp: 0,
  total_gold: 0,
  last_rhythm_tier: null,
  last_rhythm_date: null,
  last_self_neglect: null,
}

export async function loadStanding(): Promise<PlayerStandingRow> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('player_standing')
      .select('*')
      .eq('id', 'solo')
      .maybeSingle()

    if (error || !data) return { ...DEFAULT }
    return {
      id: data.id || 'solo',
      shadow_debt: Number(data.shadow_debt) || 0,
      consistency_tokens: Number(data.consistency_tokens) || 0,
      total_xp: Number(data.total_xp) || 0,
      total_gold: Number(data.total_gold) || 0,
      last_rhythm_tier: data.last_rhythm_tier ?? null,
      last_rhythm_date: data.last_rhythm_date ?? null,
      last_self_neglect: data.last_self_neglect ?? null,
      updated_at: data.updated_at,
    }
  } catch {
    return { ...DEFAULT }
  }
}

export async function saveStanding(
  patch: Partial<Omit<PlayerStandingRow, 'id'>>
): Promise<PlayerStandingRow> {
  const current = await loadStanding()
  const next: PlayerStandingRow = {
    ...current,
    ...patch,
    id: 'solo',
    updated_at: new Date().toISOString(),
  }

  try {
    const supabase = await createClient()
    await supabase.from('player_standing').upsert(
      {
        id: 'solo',
        shadow_debt: next.shadow_debt,
        consistency_tokens: next.consistency_tokens,
        total_xp: next.total_xp,
        total_gold: next.total_gold,
        last_rhythm_tier: next.last_rhythm_tier,
        last_rhythm_date: next.last_rhythm_date,
        last_self_neglect: next.last_self_neglect,
        updated_at: next.updated_at,
      },
      { onConflict: 'id' }
    )
  } catch (e) {
    console.error('saveStanding failed', e)
  }

  return next
}

/**
 * Apply a completed task into standing.
 * XP/Gold immediate. Tokens scarce.
 * Rhythm debt applies AT MOST ONCE per scored sleep date.
 */
export async function applyTaskToStanding(opts: {
  domainCount: number
  rhythmRewardEfficiency: number
  rhythmTokenMultiplier: number
  rhythmDebtDelta: number
  rhythmDate: string | null
  selfMultiplier: number
  selfNeglectSeverity: string
  rhythmTier: string | null
}): Promise<PlayerStandingRow> {
  const current = await loadStanding()

  const debtMul = Math.max(0.6, 1 - current.shadow_debt * 0.004)
  const combined = Math.max(
    0.55,
    opts.rhythmRewardEfficiency * debtMul * opts.selfMultiplier
  )

  const baseXp = 12 * Math.max(1, opts.domainCount)
  const baseGold = 6 * Math.max(1, opts.domainCount)

  const xpGain = Math.round(baseXp * combined)
  const goldGain = Math.round(baseGold * combined)

  let tokenGain = 0
  if (opts.rhythmTokenMultiplier > 0 && combined >= 0.85) {
    tokenGain = Number((0.35 * opts.rhythmTokenMultiplier * opts.selfMultiplier).toFixed(2))
  }

  // Debt only once per sleep-scored date
  let debtDelta = 0
  let nextRhythmDate = current.last_rhythm_date
  if (opts.rhythmDate && opts.rhythmDate !== current.last_rhythm_date) {
    debtDelta = opts.rhythmDebtDelta
    nextRhythmDate = opts.rhythmDate
  }

  const nextDebt = Math.max(0, Number((current.shadow_debt + debtDelta).toFixed(1)))

  return saveStanding({
    shadow_debt: nextDebt,
    consistency_tokens: Number((current.consistency_tokens + tokenGain).toFixed(2)),
    total_xp: current.total_xp + xpGain,
    total_gold: current.total_gold + goldGain,
    last_rhythm_tier: opts.rhythmTier,
    last_rhythm_date: nextRhythmDate,
    last_self_neglect: opts.selfNeglectSeverity,
  })
}

/** Spend tokens on an extra (never gates core loops). Returns false if insufficient. */
export async function spendTokens(amount: number): Promise<boolean> {
  if (amount <= 0) return false
  const current = await loadStanding()
  if (current.consistency_tokens < amount) return false
  await saveStanding({
    consistency_tokens: Number((current.consistency_tokens - amount).toFixed(2)),
  })
  return true
}
