import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const serverClient = readFileSync(
  join(process.cwd(), 'utils', 'supabase', 'server.ts'),
  'utf8'
)
const cronRoute = readFileSync(
  join(process.cwd(), 'app', 'api', 'cron', 'outreach', 'route.ts'),
  'utf8'
)
const migration = readFileSync(
  join(
    process.cwd(),
    'supabase',
    'migrations',
    '202609090001_repair_background_outreach_ownership.sql'
  ),
  'utf8'
)

describe('background outreach ownership repair', () => {
  it('scopes service-role privilege to an async context instead of changing normal clients globally', () => {
    expect(serverClient).toMatch(/new AsyncLocalStorage<boolean>\(\)/)
    expect(serverClient).toMatch(/withServiceRoleContext/)
    expect(serverClient).toMatch(/serviceRoleContext\.getStore\(\) === true/)
    expect(serverClient).toMatch(/return createServiceClient\(\)/)
  })

  it('only enters privileged mode after the cron request is authorized', () => {
    const authGuard = cronRoute.indexOf("return NextResponse.json({ error: 'Unauthorized' }")
    const privilegedRun = cronRoute.indexOf('return withServiceRoleContext(async () =>')
    expect(authGuard).toBeGreaterThan(-1)
    expect(privilegedRun).toBeGreaterThan(authGuard)
    expect(cronRoute).toMatch(/export const runtime = 'nodejs'/)
  })

  it('gives service jobs an owner default and resolves required companion ids', () => {
    expect(migration).toMatch(/create or replace function public\.current_app_user_id\(\)/i)
    expect(migration).toMatch(/alter table public\.messages[\s\S]*alter column user_id set default public\.current_app_user_id\(\)/i)
    expect(migration).toMatch(/alter table public\.scheduled_outreach[\s\S]*alter column user_id set default public\.current_app_user_id\(\)/i)
    expect(migration).toMatch(/create trigger fill_scheduled_outreach_companion_id/i)
    expect(migration).toMatch(/new\.companion_id is null/i)
  })
})
