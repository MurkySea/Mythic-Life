import { describe, expect, it } from 'vitest'

import {
  isMissingRelationshipColumn,
  withRelationshipFallback,
} from '@/lib/character-engine/relationship-compat'

describe('relationship schema compatibility', () => {
  it('detects the live missing-column failure', () => {
    expect(
      isMissingRelationshipColumn({
        code: '42703',
        message: 'column companion.trust_score does not exist',
      })
    ).toBe(true)

    expect(
      isMissingRelationshipColumn({
        code: 'PGRST116',
        message: 'The result contains 0 rows',
      })
    ).toBe(false)
  })

  it('derives dual-axis values for legacy companion rows', () => {
    const normalized = withRelationshipFallback(
      {
        slug: 'seraphine',
        affinity_score: 9,
        bond_xp: 0,
      },
      'seraphine'
    )

    expect(normalized.trust_score).toBe(78)
    expect(normalized.intimacy_score).toBe(65)
  })

  it('preserves stored Trust and Intimacy when modern columns exist', () => {
    const normalized = withRelationshipFallback(
      {
        slug: 'elowen',
        affinity_score: 2,
        bond_xp: 0,
        trust_score: 84,
        intimacy_score: 73,
      },
      'elowen'
    )

    expect(normalized.trust_score).toBe(84)
    expect(normalized.intimacy_score).toBe(73)
  })
})
