const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com'
const GITHUB_JWKS_URL = 'https://token.actions.githubusercontent.com/.well-known/jwks'
const OUTREACH_AUDIENCE = 'mythic-life-outreach'
const EXPECTED_REPOSITORY = 'MurkySea/Mythic-Life'
const EXPECTED_REF = 'refs/heads/main'
const EXPECTED_WORKFLOW = '.github/workflows/outreach-cron.yml'
const ALLOWED_EVENTS = ['schedule', 'workflow_dispatch', 'push']

type GithubOidcHeader = {
  alg?: string
  kid?: string
}

type GithubOidcClaims = {
  iss?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  repository?: string
  ref?: string
  event_name?: string
  workflow_ref?: string
}

type GithubJwk = JsonWebKey & {
  kid?: string
  alg?: string
  use?: string
}

type GithubJwks = {
  keys?: GithubJwk[]
}

let cachedKeys: { keys: GithubJwk[]; expiresAt: number } | null = null

function decodeJsonPart<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

function audienceMatches(aud: GithubOidcClaims['aud']): boolean {
  if (typeof aud === 'string') return aud === OUTREACH_AUDIENCE
  return Array.isArray(aud) && aud.includes(OUTREACH_AUDIENCE)
}

function workflowMatches(workflowRef: string | undefined): boolean {
  if (!workflowRef) return false
  return workflowRef === `${EXPECTED_REPOSITORY}/${EXPECTED_WORKFLOW}@${EXPECTED_REF}`
}

async function loadGithubKeys(): Promise<GithubJwk[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys

  const response = await fetch(GITHUB_JWKS_URL, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`GitHub OIDC JWKS returned ${response.status}`)

  const data = (await response.json()) as GithubJwks
  const keys = Array.isArray(data.keys) ? data.keys : []
  if (!keys.length) throw new Error('GitHub OIDC JWKS returned no keys')

  cachedKeys = {
    keys,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  }
  return keys
}

async function verifyRs256(
  signingInput: string,
  signaturePart: string,
  jwk: GithubJwk
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  )

  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    Buffer.from(signaturePart, 'base64url'),
    Buffer.from(signingInput)
  )
}

/**
 * Accept only short-lived GitHub Actions OIDC tokens issued to the outreach
 * workflow in this repository's main branch. The workflow itself constrains
 * push-triggered runs to changes to the heartbeat definition, so normal app
 * pushes do not gain an extra background execution path.
 */
export async function verifyGithubOutreachToken(token: string): Promise<boolean> {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return false

  const [headerPart, payloadPart, signaturePart] = parts
  const header = decodeJsonPart<GithubOidcHeader>(headerPart)
  const claims = decodeJsonPart<GithubOidcClaims>(payloadPart)
  if (!header || !claims) return false
  if (header.alg !== 'RS256' || !header.kid) return false

  const now = Math.floor(Date.now() / 1000)
  if (claims.iss !== GITHUB_OIDC_ISSUER) return false
  if (!audienceMatches(claims.aud)) return false
  if (typeof claims.exp !== 'number' || claims.exp < now - 30) return false
  if (typeof claims.nbf === 'number' && claims.nbf > now + 30) return false
  if (claims.repository !== EXPECTED_REPOSITORY) return false
  if (claims.ref !== EXPECTED_REF) return false
  if (!ALLOWED_EVENTS.includes(String(claims.event_name || ''))) return false
  if (!workflowMatches(claims.workflow_ref)) return false

  try {
    const keys = await loadGithubKeys()
    const jwk = keys.find((candidate) => candidate.kid === header.kid)
    if (!jwk) {
      cachedKeys = null
      const refreshed = await loadGithubKeys()
      const refreshedKey = refreshed.find((candidate) => candidate.kid === header.kid)
      if (!refreshedKey) return false
      return verifyRs256(`${headerPart}.${payloadPart}`, signaturePart, refreshedKey)
    }

    return verifyRs256(`${headerPart}.${payloadPart}`, signaturePart, jwk)
  } catch (error) {
    console.error('GitHub outreach OIDC verification failed', error)
    return false
  }
}

export function resetGithubOidcKeyCacheForTests(): void {
  cachedKeys = null
}
