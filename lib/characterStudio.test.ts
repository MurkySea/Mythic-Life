import { describe, expect, it } from 'vitest'
import { COMPANION_DEFS } from '@/lib/companions'
import {
  characterProfilePrompt,
  characterStageKey,
  getCharacterProfile,
} from '@/lib/characterStudio'

describe('Character Studio', () => {
  it('builds a complete profile for every companion in the playable roster', () => {
    const profiles = COMPANION_DEFS.map(getCharacterProfile)

    expect(profiles).toHaveLength(COMPANION_DEFS.length)
    expect(new Set(profiles.map((profile) => profile.slug)).size).toBe(COMPANION_DEFS.length)

    for (const profile of profiles) {
      expect(profile.northStar.length).toBeGreaterThan(20)
      expect(profile.preferredMoves.length).toBeGreaterThanOrEqual(3)
      expect(profile.memoryPriorities.length).toBeGreaterThanOrEqual(2)
      expect(profile.goodExamples.length).toBeGreaterThan(0)
      expect(profile.avoidExamples.length).toBeGreaterThan(0)
      expect(profile.temperature).toBeGreaterThanOrEqual(0.2)
      expect(profile.temperature).toBeLessThanOrEqual(1)
    }
  })

  it('produces a prompt that includes instincts, repair, memory, and calibration', () => {
    const seraphine = COMPANION_DEFS.find((def) => def.slug === 'seraphine')
    const profile = getCharacterProfile(seraphine)
    const prompt = characterProfilePrompt(profile, 8)

    expect(prompt).toContain('Comfort instinct')
    expect(prompt).toContain('Repair instinct')
    expect(prompt).toContain('Preferred conversational moves')
    expect(prompt).toContain('Memory lens')
    expect(prompt).toContain('Good calibration')
    expect(prompt).toContain('Avoid')
  })

  it('maps affinity to the intended relationship behavior stages', () => {
    expect(characterStageKey(1)).toBe('early')
    expect(characterStageKey(3)).toBe('familiar')
    expect(characterStageKey(6)).toBe('trusted')
    expect(characterStageKey(12)).toBe('close')
    expect(characterStageKey(20)).toBe('intimate')
  })
})
