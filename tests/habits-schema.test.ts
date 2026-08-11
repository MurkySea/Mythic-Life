import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '202608110001_add_habits_training.sql'),
  'utf8'
)

describe('habits owner security schema', () => {
  const tables = ['habits', 'habit_logs', 'habit_sessions', 'habit_events']

  it('enables RLS and keeps every policy owner-scoped', () => {
    for (const table of tables) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
      for (const operation of ['select', 'insert', 'update', 'delete']) {
        expect(migration).toMatch(
          new RegExp(`create policy[\\s\\S]*?on public\\.${table}\\s+for ${operation} to authenticated[\\s\\S]*?user_id = auth\\.uid\\(\\)`, 'i')
        )
      }
    }
    expect(migration).not.toMatch(/create policy[^;]*\bto\s+(?:anon|public)\b/i)
  })

  it('prevents cross-owner relationships and duplicate active timers or request events', () => {
    expect(migration).toContain('foreign key (habit_id, user_id)')
    expect(migration).toContain('habit_sessions_one_active_per_habit_idx')
    expect(migration).toMatch(/where status in \('running', 'paused'\)/i)
    expect(migration).toContain('habit_events_owner_request_key')
    expect(migration).toContain('habit_events_session_key')
  })

  it('derives timer duration from database timestamps and guards rewards', () => {
    expect(migration).toMatch(/v_now timestamptz := clock_timestamp\(\)/i)
    expect(migration).toMatch(/v_now - v_session\.active_started_at/i)
    expect(migration).toMatch(/if v_completed and v_log\.rewarded_at is null then/i)
    expect(migration).toMatch(/set total_xp = coalesce\(public\.player_standing\.total_xp, 0\) \+ excluded\.total_xp/i)
    expect(migration).toMatch(/on conflict \(skill\) do update/i)
    expect(migration).toMatch(/revoke all on function public\.finish_habit_session[\s\S]*?from public, anon/i)
  })
})
