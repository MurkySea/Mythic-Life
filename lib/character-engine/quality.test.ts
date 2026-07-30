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

function disclosureDirection() {
  const userText = 'I was raised in a very love deficient household.'
  return directConversation({
    userText,
    recentHistory: '',
    analysis: analyzeCharacterMessage(userText),
  })
}

function turnTakingDirection() {
  const userText = 'I would probably choose physical touch.'
  return directConversation({
    userText,
    recentHistory: [
      "Mark: Let's take turns asking each other questions.",
      'Seraphine: Fine. What makes you feel most cared for?',
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

  it('rejects generic acknowledgment after a depth-five disclosure', () => {
    const result = evaluateCompanionReply({
      reply: 'That tracks.',
      direction: disclosureDirection(),
    })

    expect(result.passed).toBe(false)
    expect(result.failures.join(' ')).toContain('specific meaning')
    expect(result.failures.join(' ')).toContain('quiet presence')
  })

  it('accepts specific reflection and presence after a depth-five disclosure', () => {
    const result = evaluateCompanionReply({
      reply: "Growing up without affection can teach you that love has to be earned. You don't have to rush past that with me.",
      direction: disclosureDirection(),
    })

    expect(result.passed).toBe(true)
  })

  it('requires the companion to fulfill an active turn-taking contract', () => {
    const failed = evaluateCompanionReply({
      reply: 'Physical touch makes sense.',
      direction: turnTakingDirection(),
    })
    const passed = evaluateCompanionReply({
      reply: 'Physical touch makes sense. What makes it feel safest to you?',
      direction: turnTakingDirection(),
    })

    expect(failed.passed).toBe(false)
    expect(failed.failures.join(' ')).toContain('turn-taking question contract')
    expect(passed.passed).toBe(true)
  })
})
