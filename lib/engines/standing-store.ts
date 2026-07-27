/**
 * Persistent player standing
 *
 * Supabase SQL (run once / migrate):
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
 *   date_coins int not null default 0,
 *   last_muster_date text,
 *   muster_streak int not null default 0,
 *   world_integrity numeric,
 *   updated_at timestamptz default now()
 * );
 *
 * alter table player_standing add column if not exists last_rhythm_date text;
 * alter table player_standing add column if not exists date_coins int not null default 0;
 * alter table player_standing add column if not exists last_muster_date text;
 * alter table player_standing add column if not exists muster_streak int not null default 0;
 * alter table player_standing add column if not exists world_integrity numeric;
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
  date_coins: number
  last_muster_date: string | null
  muster_streak: number
  /** 0–100 realm climate; optional until column exists */
  world_integrity: number | null
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
  date_coins: 0,
  last_muster_date: null,
  muster_streak: 0,
  world_integrity: null,
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
      date_coins: Number(data.date_coins) || 0,
      last_muster_date: data.last_muster_date ?? null,
      muster_streak: Number(data.muster_streak) || 0,
      world_integrity:
        data.world_integrity != null ? Number(data.world_integrity) : null,
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
    const row: Record<string, unknown> = {
      id: 'solo',
      shadow_debt: next.shadow_debt,
      consistency_tokens: next.consistency_tokens,
      total_xp: next.total_xp,
      total_gold: next.total_gold,
      last_rhythm_tier: next.last_rhythm_tier,
      last_rhythm_date: next.last_rhythm_date,
      last_self_neglect: next.last_self_neglect,
      date_coins: next.date_coins,
      last_muster_date: next.last_muster_date,
      muster_streak: next.muster_streak,
      updated_at: next.updated_at,
    }
    if (next.world_integrity != null) {
      row.world_integrity = next.world_integrity
    }
    await supabase.from('player_standing').upsert(row, { onConflict: 'id' })
  } catch (e) {
    console.error('saveStanding failed', e)
  }

  return next
}

export async function spendTokens(amount: number): Promise<boolean> {
  if (amount <= 0) return false
  const current = await loadStanding()
  if (current.consistency_tokens < amount) return false
  await saveStanding({
    consistency_tokens: Number((current.consistency_tokens - amount).toFixed(2)),
  })
  return true
}

export async function spendDateCoin(): Promise<boolean> {
  const current = await loadStanding()
  if (current.date_coins < 1) return false
  await saveStanding({ date_coins: current.date_coins - 1 })
  return true
}
