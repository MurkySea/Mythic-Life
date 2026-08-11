import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '202608110002_add_habit_outcomes.sql'),
  'utf8'
)

const panel = readFileSync(
  join(process.cwd(), 'app', 'habits', 'HabitOutcomePanel.tsx'),
  'utf8'
)

describe('explicit habit outcomes', () => {
  it('stores missed separately from completed and unlogged', () => {
    expect(migration).toMatch(/add column outcome text/i)
    expect(migration).toMatch(/outcome is null or outcome in \('completed', 'missed'\)/i)
    expect(migration).toMatch(/set outcome = 'completed'\s+where completed = true/i)
    expect(migration).toContain('habit_logs_sync_outcome')
  })

  it('keeps the outcome mutation owner-scoped and limited to today', () => {
    expect(migration).toMatch(/security definer/i)
    expect(migration).toMatch(/v_user_id uuid := auth\.uid\(\)/i)
    expect(migration).toMatch(/time zone 'America\/Chicago'/i)
    expect(migration).toMatch(/habit\.user_id = v_user_id/i)
    expect(migration).toMatch(/p_logged_date is distinct from v_today/i)
    expect(migration).toMatch(/revoke all on function public\.set_habit_outcome[\s\S]*?from public, anon/i)
    expect(migration).toMatch(/grant execute on function public\.set_habit_outcome[\s\S]*?to authenticated/i)
  })

  it('records a miss without deleting prior practice and protects active timers', () => {
    expect(migration).toMatch(/session\.status in \('running', 'paused'\)/i)
    expect(migration).toMatch(/outcome = 'missed'/i)
    expect(migration).toMatch(/completed = false/i)
    expect(migration).toMatch(/completed_at = null/i)
    expect(migration).not.toMatch(/rewarded_at\s*=\s*null/i)
    expect(migration).not.toMatch(/reward_xp\s*=\s*0/i)
  })

  it('exposes open, accomplished, and missed states in the UI', () => {
    expect(panel).toContain("'Accomplished'")
    expect(panel).toContain("'Missed'")
    expect(panel).toContain("'Open'")
    expect(panel).toContain('Mark missed')
    expect(panel).toContain('Clear miss')
  })
})
