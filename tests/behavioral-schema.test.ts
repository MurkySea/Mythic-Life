import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '202608070001_behavioral_foundations.sql'),
  'utf8',
)

describe('behavioral foundations schema', () => {
  it('backfills existing tasks without deleting or renaming them', () => {
    expect(migration).toMatch(/alter table public\.tasks[\s\S]*add column if not exists activity_kind/i)
    expect(migration).toMatch(/when lower\(coalesce\(recurrence, 'none'\)\) in \('daily', 'weekly'\) then 'ritual'/i)
    expect(migration).not.toMatch(/drop table|truncate/i)
  })

  it('enforces owner isolation on every new behavioral table', () => {
    for (const table of ['life_domains', 'ritual_chains', 'ritual_chain_steps', 'momentum_states', 'behavioral_profiles', 'behavioral_signals', 'action_receipts', 'world_events']) {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}[\\s\\S]*?user_id uuid (?:primary key )?references auth\\.users|create table if not exists public\\.${table}[\\s\\S]*?user_id uuid not null references auth\\.users`, 'i'))
    }
    expect(migration).toContain("to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())")
  })

  it('prevents duplicate reward receipts for the same completion', () => {
    expect(migration).toMatch(/unique \(user_id, source_type, source_id, action_type\)/i)
  })
})
