import { describe, expect, it } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { directConversation } from '@/lib/character-engine/director'
import { evaluateCompanionReply } from '@/lib/character-engine/quality'

function exhaustionDirection(userText: string) {
  return directConversation({
    userText,
    recentHistory: [
      'Mark: Exhausting, once again a day that is draining. I’m completely depleted.',
      'Seraphine: That kind of day again.',
      `Mark: ${userText}`,
    ].join('\n'),
    analysis: analyzeCharacterMessage(userText),
  })
}

describe('companion response quality gate', () => {
  it('rejects empty agreement during a vulnerable thread', () => {
    const result = evaluateCompanionReply({
      reply: 'Yeah.',
      direction: exhaustionDirection('Yeah, I’m just running on fumes'),
    })

    expect(result.passed).toBe(false)
    expect(result.failures.join(' ')).toContain('dead end')
    expect(result.retryInstruction).toContain('Rewrite once')
  })

  it('rejects unnecessary context resets', () => {
    const result = evaluateCompanionReply({
      reply: 'Suggestions for what?',
      direction: exhaustionDirection('Any suggestions?'),
    })

    expect(result.passed).toBe(false)
    expect(result.failures.join(' ')).toContain('already clear')
  })

  it('accepts a concise reply that comforts and advances the exchange', () => {
    const result = evaluateCompanionReply({
      reply: 'You are depleted. Sit down, drink something, and stay with me for a minute.',
      direction: exhaustionDirection('Yeah, I’m just running on fumes'),
    })

    expect(result.passed).toBe(true)
    expect(result.score).toBe(100)
  })
})
