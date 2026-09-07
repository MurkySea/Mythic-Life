import { describe, expect, it } from 'vitest'
import { hydrateCharacterState } from '@/lib/character-engine/persistence'
import { createDefaultCharacterState } from '@/lib/character-engine/state'

describe('Character Engine persistence', () => {
  it('hydrates and advances a complete stored state', () => {
    const stored = createDefaultCharacterState('seraphine', new Date('2026-09-05T12:00:00Z'))
    const hydrated = hydrateCharacterState({
      companionSlug: 'seraphine',
      row: {
        companion_slug: 'seraphine',
        state: stored,
        updated_at: stored.updatedAt,
      },
      now: new Date('2026-09-06T12:00:00Z'),
    })

    expect(hydrated.companionSlug).toBe('seraphine')
    expect(hydrated.updatedAt).toBe('2026-09-06T12:00:00.000Z')
  })

  it('fails safely to defaults when an old partial state is missing cognition arrays', () => {
    const hydrated = hydrateCharacterState({
      companionSlug: 'seraphine',
      row: {
        companion_slug: 'seraphine',
        updated_at: '2026-09-05T12:00:00.000Z',
        state: {
          version: 1,
          companionSlug: 'seraphine',
          mood: 'warm',
          energy: 10,
          stress: 90,
          curiosity: 20,
          confidence: 20,
          currentGoals: [],
          relationship: {
            version: 1,
            trust: 20,
            comfort: 20,
            respect: 25,
            playfulness: 10,
            admiration: 15,
            romance: 0,
            conflict: 0,
            sharedHistory: 0,
          },
          updatedAt: '2026-09-05T12:00:00.000Z',
        },
      },
      now: new Date('2026-09-06T12:00:00Z'),
    })

    expect(hydrated.unresolvedThoughts).toEqual([])
    expect(hydrated.recentEvents).toEqual([])
    expect(hydrated.stress).toBeLessThan(90)
  })
})
