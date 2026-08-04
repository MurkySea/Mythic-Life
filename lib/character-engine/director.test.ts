import { describe, expect, it } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { directConversation } from '@/lib/character-engine/director'

describe('conversation director', () => {
  it('carries exhaustion through a brief confirmation', () => {
    const userText = 'It is'
    const direction = directConversation({
      userText,
      recentHistory: [
        'Mark: Yeah, I’m just so exhausted and running on fumes',
        'Seraphine: That sounds rough.',
        'Mark: It is',
      ].join('\n'),
      analysis: analyzeCharacterMessage(userText),
    })

    expect(direction.continuity).toBe('continuation')
    expect(direction.topic).toContain('exhaustion')
    expect(direction.emotionalWeight).toBe('high')
    expect(direction.objectives).toEqual(expect.arrayContaining(['comfort', 'deepen_trust']))
    expect(direction.momentum.trajectory).toBe('deepening')
    expect(direction.avoid.join(' ')).toContain('empty agreement')
  })

  it('understands suggestions as referring to the established vulnerable topic', () => {
    const userText = 'Any suggestions?'
    const direction = directConversation({
      userText,
      recentHistory: [
        'Mark: I’m exhausted and running on fumes.',
        'Seraphine: I’m here.',
        'Mark: I don’t even know what I need right now.',
        'Seraphine: You do not have to know yet.',
        'Mark: Any suggestions?',
      ].join('\n'),
      analysis: analyzeCharacterMessage(userText),
    })

    expect(direction.continuity).toBe('continuation')
    expect(direction.mode).toBe('problem_solving')
    expect(direction.clarificationNeeded).toBe(false)
    expect(direction.objectives).toEqual(expect.arrayContaining(['acknowledge', 'offer_next_step']))
    expect(direction.goal).toContain('one small')
  })

  it('does not invent emotional weight for an ordinary standalone question', () => {
    const userText = 'What time are we leaving tomorrow?'
    const direction = directConversation({
      userText,
      recentHistory: '',
      analysis: analyzeCharacterMessage(userText),
    })

    expect(direction.emotionalWeight).toBe('normal')
    expect(direction.continuity).toBe('new_turn')
    expect(direction.momentum.trajectory).toBe('opening')
  })

  it('surfaces an active turn-taking contract with nextActor = companion', () => {
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

    expect(direction.contract).not.toBeNull()
    expect(direction.contract?.active).toBe(true)
    expect(direction.contract?.type).toBe('turn_taking_questions')
    expect(direction.contract?.nextActor).toBe('companion')
    expect(direction.obligations).toContain('fulfill_conversation_contract')
    expect(direction.responseRequirements.join(' ')).toMatch(/companion.?s turn|active agreement/i)
  })

  it('keeps the contract visible when a depth-five disclosure arrives mid-game', () => {
    const userText = 'I was raised in a very love deficient household.'
    const direction = directConversation({
      userText,
      recentHistory: [
        "Mark: Let's take turns asking each other questions.",
        'Seraphine: Fine. What made home feel safe when you were young?',
        `Mark: ${userText}`,
      ].join('\n'),
      analysis: analyzeCharacterMessage(userText),
    })

    expect(direction.contract?.active).toBe(true)
    expect(direction.disclosure.depth).toBe(5)
    expect(direction.disclosure.requiresPause).toBe(true)
    expect(direction.objectives).toEqual(
      expect.arrayContaining(['acknowledge', 'explore_disclosure', 'honor_contract'])
    )
    expect(direction.obligations).toEqual(
      expect.arrayContaining(['reflect_specific_meaning', 'fulfill_conversation_contract'])
    )
  })
})
