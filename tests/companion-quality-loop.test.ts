import { describe, expect, it } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { directConversation } from '@/lib/character-engine/director'
import {
  evaluateCompanionReply,
  type ReplyQualityResult,
} from '@/lib/character-engine/quality'
import {
  CompanionReplyQualityError,
  generateCompanionWithQualityLoop,
  requireApprovedCompanionReply,
} from '@/lib/character-engine/generation-loop'

function liveSmokeDirection() {
  const userText = "Drained but still can't sleep"
  return directConversation({
    userText,
    recentHistory: [
      "Seraphine: Tired, but the fire's still warm. You?",
      `Mark: ${userText}`,
    ].join('\n'),
    analysis: analyzeCharacterMessage(userText),
  })
}

describe('live companion relationship quality gate', () => {
  it.each([
    [
      'paraphrase-only validation',
      'That’s a rough one. Body’s tapped out but the head won’t follow.',
      'meaningful relational move',
    ],
    [
      'decorative setting in place of engagement',
      'The fire’s still going. You don’t have to sleep yet. Just… sit with it a while.',
      'Decorative setting imagery',
    ],
    [
      'standalone empty acknowledgment',
      'Yeah, that tracks.',
      'empty acknowledgment',
    ],
  ])('rejects the smoke-test failure: %s', (_case, reply, expectedFailure) => {
    const result = evaluateCompanionReply({
      reply,
      direction: liveSmokeDirection(),
    })

    expect(result.passed).toBe(false)
    expect(result.failures.join(' ')).toContain(expectedFailure)
  })

  it.each(['Yeah, that tracks.', 'That makes sense.', 'I hear you.'])(
    'rejects standalone empty acknowledgment: %s',
    (reply) => {
      const result = evaluateCompanionReply({
        reply,
        direction: liveSmokeDirection(),
      })

      expect(result.passed).toBe(false)
      expect(result.failures.join(' ')).toContain('empty acknowledgment')
    }
  )

  it('accepts grounded curiosity rather than paraphrase alone', () => {
    const result = evaluateCompanionReply({
      reply:
        "Your body sounds finished, but your mind clearly isn't. Is something specific keeping it moving, or are you stuck in that wired-tired place?",
      direction: liveSmokeDirection(),
    })

    expect(result.passed).toBe(true)
  })

  it.each(['You okay?', 'Want to talk?', 'What do you mean?'])(
    'does not count a bare or context-resetting question as grounded curiosity: %s',
    (reply) => {
      const result = evaluateCompanionReply({
        reply,
        direction: liveSmokeDirection(),
      })

      expect(result.passed).toBe(false)
      expect(result.failures.join(' ')).toContain('meaningful relational move')
    }
  )

  it('forces a rewrite when the first generated draft lacks a relational move', async () => {
    const drafts = [
      'That’s a rough one. Body’s tapped out but the head won’t follow.',
      "Your body sounds finished, but your mind clearly isn't. Is something specific keeping it moving, or are you stuck in that wired-tired place?",
    ]
    let firstQuality: ReplyQualityResult | undefined

    const result = await generateCompanionWithQualityLoop({
      direction: liveSmokeDirection(),
      generate: async ({ attempt, quality }) => {
        if (attempt === 2) firstQuality = quality
        return drafts[attempt - 1]
      },
    })

    expect(result.attempts).toBe(2)
    expect(firstQuality?.passed).toBe(false)
    expect(result.quality.passed).toBe(true)
  })

  it('blocks an unapproved conversational reply at the persistence boundary', () => {
    const reply = 'Yeah, that tracks.'
    const quality = evaluateCompanionReply({
      reply,
      direction: liveSmokeDirection(),
    })

    expect(() =>
      requireApprovedCompanionReply({
        reply,
        attempts: 3,
        quality,
      })
    ).toThrow(CompanionReplyQualityError)
  })
})
