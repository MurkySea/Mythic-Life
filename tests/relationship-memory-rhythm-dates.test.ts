import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyOutreachResponse,
  applyRhythmToCompanion,
  companionScorePatch,
  deriveDualAxis,
  intensityFromMessage,
  isCheckInMessage,
} from '@/lib/engines/relationship-wire'
import {
  dateLineForMemory,
  datePreferenceBoost,
  extractVisualHints,
  matchingTagsForDate,
} from '@/lib/memory-visual'
import { adultWeightForIntimacy, pickDateIdea } from '@/lib/engines/dates'
import { DATE_GOLD_COST, dateRewards, rollQuestLoot } from '@/lib/engines/loot'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('relationship engine wire', () => {
  const companion = {
    slug: 'seraphine',
    affinity_score: 8,
    bond_xp: 25,
    trust_score: 80,
    intimacy_score: 60,
    consecutive_bad_days: 0,
    consecutive_good_days: 0,
  }

  it('prefers stored Trust and Intimacy over legacy mirrors', () => {
    const dual = deriveDualAxis(companion)
    expect(dual.trust.value).toBe(80)
    expect(dual.intimacy.value).toBe(60)
  })

  it('classifies check-in language without gating casual messages', () => {
    expect(isCheckInMessage('You have been quiet. Are you okay?')).toBe(true)
    expect(intensityFromMessage('I am worried. Are you safe?')).toBe('urgent')
    expect(isCheckInMessage('The sunset was beautiful tonight.')).toBe(false)
  })

  it('applies responses without allowing either axis outside 0–100', () => {
    const result = applyOutreachResponse(
      { ...companion, trust_score: 100, intimacy_score: 100 },
      'honest',
      'urgent'
    )

    expect(result.trustAfter).toBeLessThanOrEqual(100)
    expect(result.intimacyAfter).toBeLessThanOrEqual(100)
    expect(result.note.length).toBeGreaterThan(0)
  })

  it('keeps Intimacy stable when Rhythm only changes Trust', () => {
    const result = applyRhythmToCompanion(companion, 'Good', '2026-07-28')
    expect(result.intimacyAfter).toBe(60)
    expect(result.consecutiveGoodDays).toBeGreaterThanOrEqual(1)
    expect(result.consecutiveBadDays).toBe(0)
  })

  it('includes only provided optional fields in score patches', () => {
    expect(
      companionScorePatch({
        affinity: 9,
        bondXp: 40,
        trustScore: 82,
      })
    ).toEqual({
      affinity_score: 9,
      bond_xp: 40,
      trust_score: 82,
    })
  })
})

describe('memory interpretation', () => {
  it('ranks repeated preferences and limits prompt flavor', () => {
    const result = extractVisualHints([
      '[relational:8] He loves fishing on the river.',
      'The lake and boat make him feel alive.',
      'He plays piano when he needs quiet.',
    ])

    expect(result.tags[0]).toBe('water')
    expect(result.tags).toContain('music')
    expect(result.lines).toHaveLength(2)
  })

  it('boosts only date ideas that match remembered preferences', () => {
    expect(datePreferenceBoost('pier_sunset', ['water'])).toBeGreaterThan(1)
    expect(datePreferenceBoost('terrace_dinner', ['water'])).toBe(1)
    expect(matchingTagsForDate('stargazing', ['water', 'stars', 'faith'])).toEqual([
      'stars',
      'faith',
    ])
  })

  it('uses the fallback line when no memory matches', () => {
    expect(dateLineForMemory('terrace_dinner', 'A quiet dinner.', ['water'])).toEqual({
      line: 'A quiet dinner.',
      fromMemory: false,
    })
  })

  it('uses a memory-aware line when the date matches', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = dateLineForMemory('pier_sunset', 'Fallback', ['water'])
    expect(result.fromMemory).toBe(true)
    expect(result.line).toContain('water')
  })
})

describe('date selection and rewards', () => {
  it('increases adult weighting as intimacy rises', () => {
    expect(adultWeightForIntimacy(100)).toBeGreaterThan(adultWeightForIntimacy(50))
    expect(adultWeightForIntimacy(50)).toBeGreaterThan(adultWeightForIntimacy(0))
  })

  it('always returns a valid date idea at random boundaries', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999999)
    const first = pickDateIdea(40, ['water'])
    const last = pickDateIdea(90, ['music'])

    expect(first.id).toBeTruthy()
    expect(last.id).toBeTruthy()
    expect(first.line).toBeTruthy()
    expect(last.setting).toBeTruthy()
  })

  it('keeps date costs and rewards positive', () => {
    const rewards = dateRewards()
    expect(DATE_GOLD_COST).toBeGreaterThan(0)
    expect(rewards.affinityDelta).toBeGreaterThan(0)
    expect(rewards.bondXpDelta).toBeGreaterThan(0)
  })

  it('keeps randomized quest rewards structurally valid', () => {
    for (let i = 0; i < 25; i++) {
      const drop = rollQuestLoot({ streak: i })
      expect(drop.amount).toBeGreaterThanOrEqual(0)
      expect(drop.label.length).toBeGreaterThan(0)
      expect(['gold', 'token', 'affinity', 'scene_credit', 'nothing']).toContain(
        drop.kind
      )
    }
  })
})
