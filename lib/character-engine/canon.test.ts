import { describe, expect, it } from 'vitest'
import {
  extractCompanionCanonFacts,
  recognitionAppearsInReply,
  updateCompanionCanonFromReply,
} from '@/lib/character-engine/canon'
import { createDefaultCharacterState } from '@/lib/character-engine/state'

describe('companion canon', () => {
  it('keeps durable self-lore but rejects invented shared-history framing', () => {
    const reply =
      "I learned to bake at Lumenvale. I’m quite good at it, which I know ruins several of your favorite jokes about my cooking."

    const facts = extractCompanionCanonFacts(reply, new Date('2026-09-07T01:00:00Z'))
    expect(facts).toHaveLength(1)
    expect(facts[0].statement).toBe('I learned to bake at Lumenvale.')
  })

  it('persists established self-lore into Character State without duplicating it', () => {
    const base = createDefaultCharacterState('seraphine', new Date('2026-09-07T01:00:00Z'))
    const once = updateCompanionCanonFromReply(base, 'I learned to bake at Lumenvale.')
    const twice = updateCompanionCanonFromReply(once, 'I learned to bake at Lumenvale.')

    expect(twice.companionCanon?.selfFacts).toHaveLength(1)
    expect(twice.companionCanon?.selfFacts[0].statement).toContain('bake at Lumenvale')
  })
})

describe('organic recognition lifecycle', () => {
  it('only counts an observation as used when the actual reply contains its substance', () => {
    const summary = 'He completed his workout habit much more consistently this week.'
    expect(recognitionAppearsInReply(summary, 'You have been unusually consistent with your workouts this week.')).toBe(true)
    expect(recognitionAppearsInReply(summary, 'Tell me what you became proud of while I was away.')).toBe(false)
  })
})
