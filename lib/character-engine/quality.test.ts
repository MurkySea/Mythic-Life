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

    expect(result.failures).toEqual([])
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

  it('rejects short non-reflective replies after a depth-five disclosure', () => {
    const result = evaluateCompanionReply({
      reply: 'I hear you.',
      direction: disclosureDirection(),
    })

    expect(result.passed).toBe(false)
    expect(result.failures.join(' ')).toMatch(/specific meaning|quiet presence|dead end/)
  })

  it('rejects therapy cadence after a significant disclosure', () => {
    const result = evaluateCompanionReply({
      reply:
        'Your feelings are valid. I am here to support you while you process your emotions in a safe space.',
      direction: disclosureDirection(),
    })

    expect(result.passed).toBe(false)
    expect(result.failures.join(' ')).toContain('therapy')
  })

  it('rejects pure topic-jump that ignores a depth-five disclosure', () => {
    const result = evaluateCompanionReply({
      reply: 'Want to talk about the project instead? Or we could plan tomorrow.',
      direction: disclosureDirection(),
    })

    expect(result.passed).toBe(false)
    expect(result.failures.join(' ')).toContain('specific meaning')
  })

  it('accepts specific reflection and presence after a depth-five disclosure', () => {
    const result = evaluateCompanionReply({
      reply:
        "Growing up without affection can teach you that love has to be earned. You don't have to rush past that with me.",
      direction: disclosureDirection(),
    })

    expect(result.passed).toBe(true)
  })

  it('accepts quiet presence that still reflects the disclosure', () => {
    const result = evaluateCompanionReply({
      reply:
        'Raised without real affection is not ordinary background. I am staying with you in that. You do not have to explain more right now.',
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

  it('still requires reflection when a contract and depth-5 disclosure collide', () => {
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

    const hollow = evaluateCompanionReply({
      reply: 'That is heavy. What is your favorite color?',
      direction,
    })
    const grounded = evaluateCompanionReply({
      reply:
        "Growing up without affection is not a light answer. I'm with you in it. What part of that still follows you most?",
      direction,
    })

    expect(hollow.passed).toBe(false)
    expect(hollow.failures.join(' ')).toMatch(/specific meaning|contract/)
    expect(grounded.failures).toEqual([])
    expect(grounded.passed).toBe(true)
  })
})
