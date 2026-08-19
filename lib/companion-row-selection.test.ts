import { describe, expect, it } from 'vitest'
import { pickCanonicalCompanionRow } from './companion-row-selection'

describe('canonical companion row selection', () => {
  it('prefers the most progressed canonical-name row in an old duplicated save', () => {
    const rows = [
      {
        id: 'stale',
        name: 'Elowen',
        slug: 'seraphine',
        affinity_score: 12,
        bond_xp: 420,
        trust_score: 88,
        intimacy_score: 58,
      },
      {
        id: 'rewarded',
        name: 'Elowen',
        slug: 'seraphine',
        affinity_score: 14,
        bond_xp: 475,
        trust_score: 88,
        intimacy_score: 58,
      },
    ]

    expect(
      pickCanonicalCompanionRow(rows, {
        canonicalName: 'Elowen',
        slug: 'seraphine',
      })?.id
    ).toBe('rewarded')
  })

  it('prefers a row with the existing portrait when gallery state is resolving duplicates', () => {
    const rows = [
      {
        id: 'progressed',
        name: 'Elowen',
        affinity_score: 18,
        bond_xp: 700,
        image_url: null,
      },
      {
        id: 'portrait',
        name: 'Elowen',
        affinity_score: 12,
        bond_xp: 420,
        image_url: 'https://example.com/elowen.jpg',
      },
    ]

    expect(
      pickCanonicalCompanionRow(rows, {
        canonicalName: 'Elowen',
        slug: 'seraphine',
        preferImage: true,
      })?.id
    ).toBe('portrait')
  })

  it('falls back to the internal slug when no canonical-name row exists', () => {
    const rows = [
      { id: 'legacy', name: 'Seraphine', slug: 'seraphine', affinity_score: 10 },
    ]

    expect(
      pickCanonicalCompanionRow(rows, {
        canonicalName: 'Elowen',
        slug: 'seraphine',
      })?.id
    ).toBe('legacy')
  })
})
