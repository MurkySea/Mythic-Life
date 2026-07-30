import { describe, expect, it, vi } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { directConversation } from '@/lib/character-engine/director'
import generateCompanionWithQualityLoop, { buildCompanionRewritePrompt } from '@/lib/character-engine/generation-loop'

function simpleDirection(userText: string) {
  return directConversation({
    userText,
    recentHistory: `Mark: ${userText}`,
    analysis: analyzeCharacterMessage(userText),
  })
}

describe('generation quality loop', () => {
  it('retries failed drafts and returns the accepted final reply', async () => {
    const dir = simpleDirection('I am exhausted and drained')
    const gen = vi.fn()
    gen.mockResolvedValueOnce('Yeah.')
    gen.mockResolvedValueOnce("You are exhausted. Sit down, drink something, and stay with me for a minute.")

    const final = await generateCompanionWithQualityLoop({
      systemPrompt: 'system',
      userPrompt: 'user',
      displayName: 'Seraphine',
      companionSlug: 'seraphine',
      direction: dir,
      maxTokens: 200,
      temperature: 0.9,
      generate: async (s, u, opts) => gen(s, u, opts),
    })

    expect(gen).toHaveBeenCalledTimes(2)
    expect(final).toContain('Sit down')
  })

  it('returns empty string when all attempts fail', async () => {
    const dir = simpleDirection('I am exhausted and drained')
    const gen = vi.fn()
    gen.mockResolvedValue('Yeah.')

    const final = await generateCompanionWithQualityLoop({
      systemPrompt: 'system',
      userPrompt: 'user',
      displayName: 'Seraphine',
      companionSlug: 'seraphine',
      direction: dir,
      maxTokens: 200,
      temperature: 0.9,
      generate: async (s, u, opts) => gen(s, u, opts),
    })

    expect(gen).toHaveBeenCalled()
    expect(final).toBe('')
  })
})
