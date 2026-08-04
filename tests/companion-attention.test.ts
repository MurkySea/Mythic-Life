import { describe, expect, it } from 'vitest'
import {
  assessEvidenceOfAttention,
  characterEnginePromptBlock,
  formatAttentionBlock,
  runCharacterEngine,
} from '@/lib/character-engine'
import { buildCompanionUserPrompt } from '@/lib/companionVoice'
import { getCompanionDef } from '@/lib/companions'

const currentUserMessage = 'The client onboarding build finally shipped today.'
const recentHistory = [
  'Mark: I was rebuilding the client onboarding flow and wanted it to feel simpler.',
  'Seraphine: You cared more about making it useful than making it impressive.',
].join('\n')

type AttentionOptions = Parameters<typeof assessEvidenceOfAttention>[0]

function context(overrides: Partial<AttentionOptions> = {}): AttentionOptions {
  const engine = runCharacterEngine({
    companionSlug: 'seraphine',
    userText: currentUserMessage,
    affinity: 6,
    hour: 18,
    recentHistory,
    def: getCompanionDef('seraphine'),
    knowledgeLines: [],
  })

  return {
    companionSlug: 'seraphine',
    currentUserMessage,
    recentHistory,
    knowledgeLines: [] as string[],
    analysis: engine.analysis,
    direction: engine.direction,
    affinity: 6,
    state: engine.state,
    random: () => 0,
    ...overrides,
  }
}

describe('Seraphine evidence of attention', () => {
  it('never activates for non-Seraphine companions', () => {
    for (const companionSlug of ['nyx', 'kira_foxveil']) {
      expect(
        assessEvidenceOfAttention(context({ companionSlug })).active
      ).toBe(false)
    }
  })

  it('can activate a clearly relevant unfinished thread', () => {
    const intent = assessEvidenceOfAttention(context())

    expect(intent.active).toBe(true)
    expect(intent.evidenceType).toBe('unfinished_thread')
    expect(intent.evidence).toContain('onboarding flow')
  })

  it('does not activate for an unrelated stored fact', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentHistory: 'Seraphine: Glad the afternoon was ordinary.',
        knowledgeLines: ['Faith is a real anchor for him.'],
      })
    )

    expect(intent.active).toBe(false)
  })

  it('does not diagnose a current turn from a stored pattern', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentHistory: 'Seraphine: I hope the project goes smoothly.',
        knowledgeLines: ['He takes care of client work by carrying every detail himself.'],
      })
    )

    expect(intent.active).toBe(false)
  })

  it('activates eligible evidence with a favorable occurrence roll', () => {
    expect(assessEvidenceOfAttention(context({ random: () => 0 })).active).toBe(true)
  })

  it('leaves eligible evidence inactive with an unfavorable occurrence roll', () => {
    expect(assessEvidenceOfAttention(context({ random: () => 0.99 })).active).toBe(false)
  })

  it('suppresses evidence already used in the latest companion reply', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentHistory: [
          'Mark: I was rebuilding the client onboarding flow and wanted it simpler.',
          'Seraphine: That client onboarding build mattered because you wanted it useful.',
        ].join('\n'),
      })
    )

    expect(intent.active).toBe(false)
  })

  it('suppresses corrections', () => {
    expect(
      assessEvidenceOfAttention(
        context({ analysis: { ...context().analysis, isCorrection: true } })
      ).active
    ).toBe(false)
  })

  it('suppresses depth-four disclosures requiring direct presence', () => {
    expect(
      assessEvidenceOfAttention(
        context({
          direction: {
            ...context().direction,
            disclosure: {
              ...context().direction.disclosure,
              depth: 4,
              requiresPause: true,
            },
          },
        })
      ).active
    ).toBe(false)
  })

  it('keeps an active conversation contract authoritative', () => {
    expect(
      assessEvidenceOfAttention(
        context({
          direction: {
            ...context().direction,
            contract: {
              type: 'turn_taking_questions',
              active: true,
              nextActor: 'companion',
              source: 'one question each',
            },
          },
        })
      ).active
    ).toBe(false)
  })

  it('cannot activate while curiosity is the primary continuity move', () => {
    expect(
      assessEvidenceOfAttention(context({ curiosityActive: true })).active
    ).toBe(false)
  })

  it('adds exactly one prompt heading when active and none when inactive', () => {
    const engine = runCharacterEngine({
      companionSlug: 'seraphine',
      userText: currentUserMessage,
      affinity: 6,
      hour: 18,
      recentHistory,
      def: getCompanionDef('seraphine'),
    })
    const active = assessEvidenceOfAttention(context())
    const promptWithAttention = buildCompanionUserPrompt({
      displayName: 'Seraphine',
      isConversation: true,
      triggerText: currentUserMessage,
      mood: 'warm',
      engine: {
        direction: engine.direction,
        promptBlock: characterEnginePromptBlock({
          analysis: engine.analysis,
          decision: engine.decision,
          direction: engine.direction,
          state: engine.state,
          attention: active,
        }),
      },
    })
    const promptWithoutAttention = buildCompanionUserPrompt({
      displayName: 'Seraphine',
      isConversation: true,
      triggerText: currentUserMessage,
      mood: 'warm',
      engine: {
        direction: engine.direction,
        promptBlock: characterEnginePromptBlock({
          analysis: engine.analysis,
          decision: engine.decision,
          direction: engine.direction,
          state: engine.state,
        }),
      },
    })

    expect(promptWithAttention.match(/EVIDENCE OF ATTENTION/g)).toHaveLength(1)
    expect(promptWithoutAttention.match(/EVIDENCE OF ATTENTION/g) ?? []).toHaveLength(0)
  })

  it('injects only the single selected evidence item', () => {
    const intent = assessEvidenceOfAttention(
      context({
        knowledgeLines: [
          'He wants client systems to feel simple and useful.',
          'He measures success by becoming worthy of winning.',
        ],
      })
    )
    const block = formatAttentionBlock(intent)

    expect(intent.evidenceType).toBe('unfinished_thread')
    expect(block).toContain('onboarding flow')
    expect(block).not.toContain('worthy of winning')
  })
})
