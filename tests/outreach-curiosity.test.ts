import { describe, expect, it } from 'vitest'
import {
  curiosityInitiationEligible,
  heavyOutreachId,
} from '@/lib/outreach'

describe('curiosity outreach policy', () => {
  const eligible = {
    companionSlug: 'seraphine',
    hoursSilent: 12,
    affinity: 4,
    gapSeverity: 0.4,
    hasHeavyOutreach: false,
  }

  it('requires Seraphine, 12 hours of silence, affinity 4, and a real gap', () => {
    expect(curiosityInitiationEligible(eligible)).toBe(true)
    expect(
      curiosityInitiationEligible({ ...eligible, companionSlug: 'nyx' })
    ).toBe(false)
    expect(
      curiosityInitiationEligible({ ...eligible, hoursSilent: 11.99 })
    ).toBe(false)
    expect(curiosityInitiationEligible({ ...eligible, affinity: 3 })).toBe(false)
    expect(
      curiosityInitiationEligible({ ...eligible, gapSeverity: null })
    ).toBe(false)
    expect(
      curiosityInitiationEligible({ ...eligible, gapSeverity: 0.39 })
    ).toBe(false)
  })

  it('shares the heavy-emotional daily slot', () => {
    expect(
      curiosityInitiationEligible({ ...eligible, hasHeavyOutreach: true })
    ).toBe(false)
  })

  it('uses one deterministic primary key for a companion heavy slot per day', () => {
    const today = heavyOutreachId('seraphine', '2026-08-03')

    expect(today).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(heavyOutreachId('seraphine', '2026-08-03')).toBe(today)
    expect(heavyOutreachId('seraphine', '2026-08-04')).not.toBe(today)
    expect(heavyOutreachId('nyx', '2026-08-03')).not.toBe(today)
  })
})
