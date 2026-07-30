import { describe, expect, it } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { directConversation } from '@/lib/character-engine/director'

describe('companion social intelligence', () => {
  it('recognizes and honors a turn-taking question agreement', () => {
    const userText = 'I would probably choose physical touch.'
    const direction = directConversation({
      userText,
      recentHistory: [
        "Mark: Let's take turns asking each other questions.",
        'Seraphine: Fine. What makes you feel most cared for?',
        `Mark: ${userText}`,
      ].join('\n'),
      analysis: analyzeCharacterMessage(userText),
    })

    expect(direction.contract?.active).toBe(true)
    expect(direction.contract?.type).toBe('turn_taking_questions')
    expect(direction.contract?.nextActor).toBe('companion')
    expect(direction.objectives).toContain('honor_contract')
    expect(direction.obligations).toContain('fulfill_conversation_contract')
  })

  it('treats a formative love-deficient childhood disclosure as depth five', () => {
    const userText = 'I was raised in a very love deficient household.'
    const direction = directConversation({
      userText,
      recentHistory: '',
      analysis: analyzeCharacterMessage(userText),
    })

    expect(direction.disclosure.depth).toBe(5)
    expect(direction.disclosure.categories).toContain('childhood')
    expect(direction.disclosure.requiresPause).toBe(true)
    expect(direction.objectives).toEqual(
      expect.arrayContaining(['acknowledge', 'explore_disclosure', 'stay_present'])
    )
    expect(direction.obligations).toContain('reflect_specific_meaning')
    expect(direction.avoid.join(' ')).toContain('moving past the disclosure')
  })

  it('does not inflate an ordinary preference into a major disclosure', () => {
    const userText = 'My favorite pizza is pepperoni.'
    const direction = directConversation({
      userText,
      recentHistory: '',
      analysis: analyzeCharacterMessage(userText),
    })

    expect(direction.disclosure.depth).toBe(2)
    expect(direction.disclosure.requiresPause).toBe(false)
    expect(direction.obligations).not.toContain('offer_quiet_presence')
  })
})
