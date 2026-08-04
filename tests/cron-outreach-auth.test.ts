import { afterEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/cron/outreach/route'

const originalSecret = process.env.CRON_SECRET

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
})

describe('outreach cron authentication', () => {
  it('fails closed when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const response = await GET(new Request('https://example.test/api/cron/outreach'))

    expect(response.status).toBe(401)
  })

  it('rejects a mismatched bearer token', async () => {
    process.env.CRON_SECRET = 'expected-secret'

    const response = await GET(
      new Request('https://example.test/api/cron/outreach', {
        headers: { authorization: 'Bearer wrong-secret' },
      })
    )

    expect(response.status).toBe(401)
  })
})
