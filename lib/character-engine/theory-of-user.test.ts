import { describe, expect, it } from 'vitest'
import { createDefaultCharacterState } from '@/lib/character-engine/state'
import { updateTheoryOfUser } from '@/lib/character-engine/theory-of-user'
import type { CharacterAnalysis, DisclosureAssessment } from '@/lib/character-engine/types'

const analysis: CharacterAnalysis = {
  intent: 'reflection',
  need: 'be_heard',
  confidence: 0.9,
  isVulnerable: false,
  isCorrection: false,
  isExplicitAdviceRequest: false,
  isExplicitFlirtation: false,
  asksQuestion: false,
}

const preferenceDisclosure: DisclosureAssessment = {
  depth: 2,
  categories: ['preference'],
  requiresPause: false,
  rationale: ['clear preference'],
}

describe('Theory of User', () => {
  it('stores high-signal beliefs with evidence instead of flattening them into certainty', () => {
    const state = createDefaultCharacterState('seraphine', new Date('2026-09-07T00:00:00Z'))
    const next = updateTheoryOfUser({
      state,
      userText: 'I prefer games where the combat is precise and I can parry.',
      analysis,
      disclosure: preferenceDisclosure,
      now: new Date('2026-09-07T00:01:00Z'),
    })

    expect(next.theoryOfUser?.beliefs).toHaveLength(1)
    expect(next.theoryOfUser?.beliefs[0].category).toBe('preference')
    expect(next.theoryOfUser?.beliefs[0].evidence[0].quote).toContain('combat is precise')
    expect(next.theoryOfUser?.beliefs[0].confidence).toBeLessThanOrEqual(1)
  })

  it('weakens a relevant belief when Mark explicitly corrects it', () => {
    const state = createDefaultCharacterState('seraphine', new Date('2026-09-07T00:00:00Z'))
    const learned = updateTheoryOfUser({
      state,
      userText: 'I prefer games where the combat is precise and I can parry.',
      analysis,
      disclosure: preferenceDisclosure,
      now: new Date('2026-09-07T00:01:00Z'),
    })
    const before = learned.theoryOfUser!.beliefs[0].confidence

    const corrected = updateTheoryOfUser({
      state: learned,
      userText: "No, actually I don't prefer precise parry combat all the time.",
      analysis: { ...analysis, intent: 'correction', isCorrection: true },
      disclosure: preferenceDisclosure,
      now: new Date('2026-09-07T00:02:00Z'),
    })

    const revised = corrected.theoryOfUser!.beliefs.find((belief) => belief.status === 'revised')
    expect(revised).toBeDefined()
    expect(revised!.confidence).toBeLessThan(before)
    expect(revised!.evidence.some((item) => item.stance === 'contradict')).toBe(true)
  })
})
