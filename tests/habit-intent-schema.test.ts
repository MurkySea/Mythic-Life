import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '202608120001_add_habit_intent.sql'),
  'utf8'
)

describe('habit build and avoid intent schema', () => {
  it('adds a constrained build or avoid intent with build as the safe default', () => {
    expect(migration).toMatch(/add column(?: if not exists)? intent text not null default 'build'/i)
    expect(migration).toMatch(/intent in \('build', 'avoid'\)/i)
  })

  it('allows completed outcomes only for avoid habits', () => {
    expect(migration).toMatch(/p_outcome not in \('completed', 'missed', 'unlogged'\)/i)
    expect(migration).toMatch(/p_outcome = 'completed' and v_habit\.intent <> 'avoid'/i)
  })

  it('awards avoid success through the existing standing and skill XP model', () => {
    expect(migration).toMatch(/if p_outcome = 'completed' and v_log\.rewarded_at is null then/i)
    expect(migration).toMatch(/insert into public\.player_standing/i)
    expect(migration).toMatch(/insert into public\.player_skills/i)
  })

  it('keeps the outcome RPC authenticated only', () => {
    expect(migration).toMatch(/revoke all on function public\.set_habit_outcome\(uuid, date, text\) from public, anon/i)
    expect(migration).toMatch(/grant execute on function public\.set_habit_outcome\(uuid, date, text\) to authenticated/i)
  })
})
