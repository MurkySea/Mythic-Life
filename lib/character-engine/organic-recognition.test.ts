import { describe, expect, it } from 'vitest'
import {
  canOfferOrganicRecognition,
  deriveHabitRecognition,
  weekKeyForDate,
  type HabitRecognitionLog,
} from '@/lib/character-engine/organic-recognition'
import type { CharacterAnalysis } from '@/lib/character-engine/types'

function completed(title: string, loggedDate: string, habitId = title): HabitRecognitionLog {
  return { habitId, title, loggedDate, completed: true }
}

const ordinaryAnalysis: CharacterAnalysis = {
  intent: 'company',
  need: 'company',
  confidence: 0.9,
  isVulnerable: false,
  isCorrection: false,
  isExplicitAdviceRequest: false,
  isExplicitFlirtation: false,
  asksQuestion: false,
}

describe('organic companion recognition', () => {
  it("notices an unusually strong week against the player's own recent baseline", () => {
    const logs = [
      completed('Walk', '2026-09-06'),
      completed('Workout', '2026-09-05'),
      completed('Walk', '2026-09-04'),
      completed('Workout', '2026-09-03'),
      completed('Walk', '2026-09-02'),
      completed('Workout', '2026-09-01'),
      completed('Walk', '2026-08-31'),
      completed('Walk', '2026-08-24'),
      completed('Workout', '2026-08-18'),
      completed('Walk', '2026-08-12'),
    ]

    const candidate = deriveHabitRecognition({ todayKey: '2026-09-06', logs })

    expect(candidate?.topic).toBe('organic_recognition')
    expect(candidate?.id).toBe('organic:habit-week:2026-08-31')
    expect(candidate?.summary).toContain('7 habit completions')
    expect(candidate?.summary).toContain('recent baseline')
    expect(candidate?.importance).toBeGreaterThanOrEqual(80)
  })

  it('does not manufacture praise for an ordinary week', () => {
    const logs = [
      completed('Walk', '2026-09-05'),
      completed('Workout', '2026-09-02'),
      completed('Walk', '2026-08-25'),
      completed('Workout', '2026-08-19'),
      completed('Walk', '2026-08-13'),
    ]

    expect(deriveHabitRecognition({ todayKey: '2026-09-06', logs })).toBeNull()
  })

  it('keeps recognition subordinate to vulnerable or corrective conversation', () => {
    expect(
      canOfferOrganicRecognition({ analysis: ordinaryAnalysis, disclosureDepth: 1 })
    ).toBe(true)

    expect(
      canOfferOrganicRecognition({
        analysis: { ...ordinaryAnalysis, isVulnerable: true, intent: 'reflection' },
        disclosureDepth: 4,
      })
    ).toBe(false)

    expect(
      canOfferOrganicRecognition({
        analysis: { ...ordinaryAnalysis, isCorrection: true, intent: 'correction' },
        disclosureDepth: 1,
      })
    ).toBe(false)
  })

  it('uses a Monday key so the same week does not create duplicate thoughts', () => {
    expect(weekKeyForDate('2026-09-06')).toBe('2026-08-31')
    expect(weekKeyForDate('2026-09-01')).toBe('2026-08-31')
  })
})
