import { generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  resetGithubOidcKeyCacheForTests,
  verifyGithubOutreachToken,
} from '@/lib/github-actions-oidc'

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

describe('GitHub Actions outreach OIDC verification', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicExponent: 0x10001,
  })
  const publicJwk = publicKey.export({ format: 'jwk' }) as JsonWebKey

  afterEach(() => {
    vi.restoreAllMocks()
    resetGithubOidcKeyCacheForTests()
  })

  function tokenFor(overrides: Record<string, unknown> = {}): string {
    const header = base64urlJson({ alg: 'RS256', kid: 'test-key', typ: 'JWT' })
    const payload = base64urlJson({
      iss: 'https://token.actions.githubusercontent.com',
      aud: 'mythic-life-outreach',
      exp: Math.floor(Date.now() / 1000) + 300,
      nbf: Math.floor(Date.now() / 1000) - 10,
      repository: 'MurkySea/Mythic-Life',
      ref: 'refs/heads/main',
      event_name: 'schedule',
      workflow_ref:
        'MurkySea/Mythic-Life/.github/workflows/outreach-cron.yml@refs/heads/main',
      ...overrides,
    })
    const input = `${header}.${payload}`
    const signature = sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')
    return `${input}.${signature}`
  }

  function mockJwks(): void {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  }

  it('accepts the scheduled workflow from this repository main branch', async () => {
    mockJwks()
    await expect(verifyGithubOutreachToken(tokenFor())).resolves.toBe(true)
  })

  it('also allows a manual workflow dispatch for diagnostics', async () => {
    mockJwks()
    await expect(
      verifyGithubOutreachToken(tokenFor({ event_name: 'workflow_dispatch' }))
    ).resolves.toBe(true)
  })

  it('allows the path-limited main-branch push self-test from the same outreach workflow', async () => {
    mockJwks()
    await expect(
      verifyGithubOutreachToken(tokenFor({ event_name: 'push' }))
    ).resolves.toBe(true)
  })

  it('rejects a validly signed token from another repository', async () => {
    mockJwks()
    await expect(
      verifyGithubOutreachToken(tokenFor({ repository: 'someone/else' }))
    ).resolves.toBe(false)
  })

  it('rejects a validly signed push token from another workflow or branch', async () => {
    mockJwks()
    await expect(
      verifyGithubOutreachToken(
        tokenFor({
          event_name: 'push',
          ref: 'refs/heads/feature',
          workflow_ref:
            'MurkySea/Mythic-Life/.github/workflows/other.yml@refs/heads/feature',
        })
      )
    ).resolves.toBe(false)
  })
})
