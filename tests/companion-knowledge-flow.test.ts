import { describe, expect, it } from 'vitest'
import { buildCompanionSystemPrompt } from '@/lib/companionVoice'
import { COMPANION_DEFS } from '@/lib/companions'
import { extractKnowledgeCandidate, formatKnowledgeBlock } from '@/lib/character-engine/knowledge'

describe('persistent companion knowledge flow', () => {
  it('extracts a durable, high-signal disclosure and injects it into generation context', () => {
    const candidate = extractKnowledgeCandidate({
      userText: 'What matters to me is becoming the kind of person worthy of winning, not merely getting the win.',
      analysis: {
        intent: 'reflection',
        need: 'be_heard',
        isVulnerable: true,
        confidence: 0.9,
        isCorrection: false,
        isExplicitAdviceRequest: false,
        isExplicitFlirtation: false,
        asksQuestion: false,
      },
      disclosure: {
        depth: 4,
        categories: ['identity'],
        requiresPause: true,
        rationale: ['durable value disclosure'],
      },
    })

    expect(candidate?.kind).toBe('value')

    const prompt = buildCompanionSystemPrompt({
      def: COMPANION_DEFS.find((companion) => companion.slug === 'seraphine'),
      displayName: 'Seraphine',
      affinity: 4,
      mood: 'warm',
      memoryBlock: '',
      historyBlock: '',
      knowledgeBlock: formatKnowledgeBlock([candidate!.content]),
    })

    expect(prompt).toContain(candidate!.content)
    expect(prompt).toContain('What she has earned knowledge of about him')
  })

  it('does not persist ordinary low-signal conversation as durable knowledge', () => {
    const candidate = extractKnowledgeCandidate({
      userText: 'I had eggs for breakfast this morning.',
      analysis: {
        intent: 'unknown',
        need: 'unknown',
        isVulnerable: false,
        confidence: 0.8,
        isCorrection: false,
        isExplicitAdviceRequest: false,
        isExplicitFlirtation: false,
        asksQuestion: false,
      },
      disclosure: {
        depth: 1,
        categories: [],
        requiresPause: false,
        rationale: [],
      },
    })

    expect(candidate).toBeNull()
  })
})
