import { describe, expect, it } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { directConversation } from '@/lib/character-engine/director'
import {
  buildCompanionRewritePrompt,
  generateCompanionWithQualityLoop,
} from '@/lib/character-engine/generation-loop'

function sleepDirection() {
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

describe('enforced companion generation loop', () => {
  it('rejects a hollow first draft and returns the corrected draft', async () => {
    const drafts = [
      "Drained and restless is a hard loop. The fire's still going if that helps at all.",
      "Your body sounds finished, but your mind clearly isn't. Stay with me a minute—is something specific keeping it moving, or are you stuck in that wired-tired place?",
    ]

    const result = await generateCompanionWithQualityLoop({
      direction: sleepDirection(),
      generate: async ({ attempt }) => drafts[attempt - 1],
    })

    expect(result.attempts).toBe(2)
    expect(result.reply).toContain('wired-tired')
    expect(result.quality.passed).toBe(true)
  })

  it('provides concrete failure feedback to the rewrite call', () => {
    const prompt = buildCompanionRewritePrompt({
      attempt: 2,
      direction: sleepDirection(),
      previousDraft: "The fire's still going.",
      quality: {
        passed: false,
        score: 52,
        failures: ['The reply does not add a human or conversational next move.'],
      },
    })

    expect(prompt).toContain('PREVIOUS DRAFT')
    expect(prompt).toContain('FAILURES')
    expect(prompt).toContain('specific relational move')
  })

  it('quality-checks the grounded fallback after every model draft fails', async () => {
    const result = await generateCompanionWithQualityLoop({
      direction: sleepDirection(),
      maxAttempts: 2,
      generate: async () => "The fire's still going.",
    })

    expect(result.attempts).toBe(2)
    expect(result.quality.passed).toBe(true)
    expect(result.reply).toContain('wired-tired')
  })
})
