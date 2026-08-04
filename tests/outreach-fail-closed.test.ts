import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/utils/supabase/server'
import {
  hasHeavyOutreachToday,
  maybeScheduleCuriosityInitiation,
} from '@/lib/outreach'

describe('heavy outreach lookup failures', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('fails closed when infrastructure throws before the query can run', async () => {
    vi.mocked(createClient).mockRejectedValueOnce(new Error('Supabase unavailable'))

    await expect(hasHeavyOutreachToday('seraphine')).resolves.toBe(true)
  })

  it('prevents curiosity scheduling when the heavy-outreach lookup throws', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T18:00:00-05:00'))
    vi.mocked(createClient).mockRejectedValueOnce(new Error('Supabase unavailable'))

    await expect(maybeScheduleCuriosityInitiation()).resolves.toBe(false)
    expect(createClient).toHaveBeenCalledTimes(1)
  })
})
