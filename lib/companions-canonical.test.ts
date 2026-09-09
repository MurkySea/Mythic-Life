import { describe, expect, it } from 'vitest'
import { COMPANION_DEFS, getCompanionDef } from './companions'

describe('canonical companion roster', () => {
  it('has exactly one definition per slug', () => {
    const slugs = COMPANION_DEFS.map((companion) => companion.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('keeps Elowen on the legacy founding slug and Seraphine separate', () => {
    expect(getCompanionDef('seraphine')?.name).toBe('Elowen')
    expect(getCompanionDef('seraphine_quietflame')?.name).toBe('Seraphine')
  })
})
