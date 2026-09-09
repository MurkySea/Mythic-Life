import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '202609080001_add_daily_rituals.sql'),
  'utf8'
)

describe('daily ritual schema', () => {
  it('stores only one ritual row per person per local day', () => {
    expect(migration).toMatch(/unique \(user_id, ritual_date\)/i)
    expect(migration).toMatch(/main_quest_task_id uuid null references public\.tasks\(id\) on delete set null/i)
  })

  it('captures the morning orientation and companion response', () => {
    expect(migration).toMatch(/morning_intention text null/i)
    expect(migration).toMatch(/morning_resistance text null/i)
    expect(migration).toMatch(/morning_identity text null/i)
    expect(migration).toMatch(/morning_response text null/i)
    expect(migration).toMatch(/morning_completed_at timestamptz null/i)
  })

  it('is owner-only under RLS', () => {
    expect(migration).toMatch(/alter table public\.daily_rituals enable row level security/i)
    expect(migration).toMatch(/using \(\(select auth\.uid\(\)\) = user_id\)/i)
    expect(migration).toMatch(/with check \(\(select auth\.uid\(\)\) = user_id\)/i)
  })
})
