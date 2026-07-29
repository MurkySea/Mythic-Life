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
    expect(direction.mode).toBe('guided_clarity')
    expect(direction.clarificationNeeded).toBe(false)
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
  })
})
