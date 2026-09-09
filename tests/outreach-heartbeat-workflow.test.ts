import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  join(process.cwd(), '.github', 'workflows', 'outreach-cron.yml'),
  'utf8'
)

describe('companion outreach heartbeat workflow', () => {
  it('targets the public production alias instead of the Vercel-SSO protected alias', () => {
    expect(workflow).toContain('https://mythic-life-bice.vercel.app/api/cron/outreach')
    expect(workflow).not.toContain('https://mythic-life-murky.vercel.app/api/cron/outreach')
  })

  it('fails loudly if production starts redirecting again', () => {
    expect(workflow).toMatch(/--location/)
    expect(workflow).toMatch(/--max-redirs 0/)
  })

  it('requires the app heartbeat response to prove it actually executed', () => {
    expect(workflow).toMatch(/jq -e '\.ok == true and \.privileged == true'/)
  })
})
