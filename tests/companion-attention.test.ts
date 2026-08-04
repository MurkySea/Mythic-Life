import { describe, expect, it } from 'vitest'
import {
  assessEvidenceOfAttention,
  characterEnginePromptBlock,
  formatAttentionBlock,
  runCharacterEngine,
  type AttentionRecentTurn,
} from '@/lib/character-engine'
import { buildCompanionUserPrompt } from '@/lib/companionVoice'
import { getCompanionDef } from '@/lib/companions'

const currentUserMessage = 'The client onboarding build finally shipped today.'
const recentTurns: AttentionRecentTurn[] = [
  {
    role: 'user',
    content: 'I was rebuilding the client onboarding flow and wanted it to feel simpler.',
  },
  {
    role: 'companion',
    content: 'You cared more about making it useful than making it impressive.',
  },
]

type AttentionOptions = Parameters<typeof assessEvidenceOfAttention>[0]

function historyForEngine(turns: AttentionRecentTurn[]): string {
  return turns
    .map((turn) => `${turn.role === 'user' ? 'Mark' : 'Seraphine'}: ${turn.content}`)
    .join('\n')
}

function contextFor(
  message: string,
  overrides: Partial<AttentionOptions> = {}
): AttentionOptions {
  const turns = overrides.recentTurns ?? recentTurns
  const engine = runCharacterEngine({
    companionSlug: 'seraphine',
    userText: message,
    affinity: 6,
    hour: 18,
    recentHistory: historyForEngine(turns),
    def: getCompanionDef('seraphine'),
    knowledgeLines: overrides.knowledgeLines ?? [],
  })

  return {
    companionSlug: 'seraphine',
    currentUserMessage: message,
    recentTurns: turns,
    knowledgeLines: [],
    analysis: engine.analysis,
    direction: engine.direction,
    affinity: 6,
    state: engine.state,
    random: () => 0,
    ...overrides,
  }
}

function context(overrides: Partial<AttentionOptions> = {}): AttentionOptions {
  return contextFor(currentUserMessage, overrides)
}

describe('Seraphine evidence of attention', () => {
  it('never activates for non-Seraphine companions', () => {
    for (const companionSlug of ['nyx', 'kira_foxveil']) {
      expect(assessEvidenceOfAttention(context({ companionSlug })).active).toBe(false)
    }
  })

  it('can activate a clearly relevant unfinished thread', () => {
    const intent = assessEvidenceOfAttention(context())

    expect(intent.active).toBe(true)
    expect(intent.evidenceType).toBe('unfinished_thread')
    expect(intent.evidence).toContain('onboarding flow')
  })

  it.each([
    ['Lauren and I went to dinner tonight.', 'He wants to build a home on acreage.'],
    ['A client canceled our meeting.', 'The homestead build represents his long-term legacy.'],
    ['I played piano tonight.', 'Fishing helps him reset.'],
    ['I finished a book.', 'He needs to study for work.'],
  ])('keeps unrelated concepts inactive: %s', (message, evidence) => {
    const intent = assessEvidenceOfAttention(
      contextFor(message, {
        recentTurns: [{ role: 'companion', content: 'That sounds like an ordinary evening.' }],
        knowledgeLines: [evidence],
      })
    )

    expect(intent.active).toBe(false)
  })

  it.each([
    ['The client onboarding shipped.', 'Client onboarding matters to him.'],
    ['I played piano tonight.', 'He prefers music practice when he needs room to think.'],
    ['I am tired and need sleep.', 'He prefers rest before pushing through exhaustion.'],
    ['Lauren and I had dinner.', 'His wife Lauren matters deeply to him.'],
  ])('preserves a narrow related concept: %s', (message, evidence) => {
    const intent = assessEvidenceOfAttention(
      contextFor(message, {
        recentTurns: [{ role: 'companion', content: 'I am listening.' }],
        knowledgeLines: [evidence],
      })
    )

    expect(intent.active).toBe(true)
  })

  it.each([
    [
      'A client canceled our meeting today.',
      'I helped a client prepare for retirement.',
    ],
    ['A client called me this afternoon.', 'Client work matters to him.'],
  ])('keeps generic client-only overlap inactive: %s', (message, evidence) => {
    const intent = assessEvidenceOfAttention(
      contextFor(message, {
        recentTurns: [{ role: 'companion', content: 'I am listening.' }],
        knowledgeLines: [evidence],
      })
    )

    expect(intent.active).toBe(false)
  })

  it.each([
    [
      'The client onboarding build finally shipped.',
      'I was rebuilding the client onboarding flow.',
    ],
    [
      'The retirement client signed the paperwork.',
      'I was helping that retirement client finish the plan.',
    ],
  ])('activates client evidence with specific shared context: %s', (message, evidence) => {
    const intent = assessEvidenceOfAttention(
      contextFor(message, {
        recentTurns: [
          { role: 'user', content: evidence },
          { role: 'companion', content: 'I remember you working through it.' },
        ],
      })
    )

    expect(intent.active).toBe(true)
    expect(intent.evidence).toBe(evidence)
  })

  it('prefers the most recent prior-user evidence when relevance scores tie', () => {
    const older = 'I mapped the client onboarding flow.'
    const newer = 'I simplified the client onboarding flow.'
    const intent = assessEvidenceOfAttention(
      contextFor('The client onboarding flow changed today.', {
        recentTurns: [
          { role: 'user', content: older },
          { role: 'companion', content: 'You were taking it one piece at a time.' },
          { role: 'user', content: newer },
          { role: 'companion', content: 'That sounds cleaner.' },
        ],
      })
    )

    expect(intent.active).toBe(true)
    expect(intent.evidence).toBe(newer)
  })

  it('does not diagnose a current turn from a stored pattern', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentTurns: [{ role: 'companion', content: 'I hope the project goes smoothly.' }],
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

  it('suppresses evidence used in the latest companion reply', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentTurns: [
          recentTurns[0],
          { role: 'companion', content: 'That client onboarding build mattered to you.' },
        ],
      })
    )

    expect(intent.active).toBe(false)
  })

  it('suppresses evidence used two companion replies ago', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentTurns: [
          recentTurns[0],
          { role: 'companion', content: 'That client onboarding build mattered to you.' },
          { role: 'user', content: 'The afternoon got busy after that.' },
          { role: 'companion', content: 'Busy in the useful way, or just noisy?' },
        ],
      })
    )

    expect(intent.active).toBe(false)
  })

  it('does not suppress eligible evidence because of unrelated recent replies', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentTurns: [
          recentTurns[0],
          { role: 'companion', content: 'Dinner sounded peaceful.' },
          { role: 'user', content: 'It was. The rest of the evening was quiet.' },
          { role: 'companion', content: 'I am glad you had that room.' },
        ],
      })
    )

    expect(intent.active).toBe(true)
  })

  it('preserves speaker attribution for multiline turns', () => {
    const intent = assessEvidenceOfAttention(
      context({
        recentTurns: [
          {
            role: 'user',
            content: 'I started rebuilding the client onboarding flow.\nThe client handoff was the unfinished part.',
          },
          {
            role: 'companion',
            content: 'You were taking it carefully.\nI hoped the afternoon gave you room.',
          },
        ],
      })
    )

    expect(intent.active).toBe(true)
    expect(intent.evidence).toContain('client handoff')
  })

  it('suppresses corrections', () => {
    const base = context()
    expect(
      assessEvidenceOfAttention({
        ...base,
        analysis: { ...base.analysis, isCorrection: true },
      }).active
    ).toBe(false)
  })

  it('suppresses depth four even when requiresPause is false', () => {
    const base = context()
    expect(
      assessEvidenceOfAttention({
        ...base,
        direction: {
          ...base.direction,
          disclosure: {
            ...base.direction.disclosure,
            depth: 4,
            requiresPause: false,
          },
        },
      }).active
    ).toBe(false)
  })

  it('keeps an active conversation contract authoritative', () => {
    const base = context()
    expect(
      assessEvidenceOfAttention({
        ...base,
        direction: {
          ...base.direction,
          contract: {
            type: 'turn_taking_questions',
            active: true,
            nextActor: 'companion',
            source: 'one question each',
          },
        },
      }).active
    ).toBe(false)
  })

  it.each([
    ['Can you help me think this through?', 'I need help thinking this through.'],
    ['What do you think I should do?', 'Yesterday I asked what you think I should do.'],
    ['Tell me what you noticed.', 'I wanted you to tell me what you noticed.'],
  ])('suppresses direct questions and explicit requests: %s', (message, priorMessage) => {
    const intent = assessEvidenceOfAttention(
      contextFor(message, {
        recentTurns: [
          { role: 'user', content: priorMessage },
          { role: 'companion', content: 'I was listening.' },
        ],
      })
    )

    expect(intent.active).toBe(false)
  })

  it.each([
    ['I keep thinking about childhood trauma and abuse.', 'He carries childhood trauma from being abused.'],
    ['I keep thinking about the sexual assault.', 'He survived sexual abuse and assault.'],
    ['I keep feeling chosen instead of merely tolerated.', 'Being chosen rather than tolerated matters deeply.'],
    ['I keep feeling useful only when helping people.', 'He feels valuable only when helping others.'],
    ['I keep fearing people will leave me.', 'He fears abandonment and people leaving.'],
    ['I keep carrying all this pressure alone.', 'He handles pressure and carries everything alone.'],
    ['I keep feeling like I am not wanted or loved.', 'He often does not feel wanted or loved.'],
    ['I keep struggling to receive love and care.', 'Receiving love or care is difficult for him.'],
  ])('blocks sensitive evidence even with a favorable roll: %s', (message, evidence) => {
    const base = contextFor(message, {
      recentTurns: [{ role: 'companion', content: 'I am here with you.' }],
      knowledgeLines: [evidence],
      random: () => 0,
    })
    const intent = assessEvidenceOfAttention({
      ...base,
      analysis: { ...base.analysis, isVulnerable: false },
      direction: {
        ...base.direction,
        disclosure: { ...base.direction.disclosure, depth: 1, requiresPause: false },
      },
    })

    expect(intent.active).toBe(false)
  })

  it('cannot activate while curiosity is the primary continuity move', () => {
    expect(assessEvidenceOfAttention(context({ curiosityActive: true })).active).toBe(false)
  })

  it('adds exactly one prompt heading when active and none when inactive', () => {
    const engine = runCharacterEngine({
      companionSlug: 'seraphine',
      userText: currentUserMessage,
      affinity: 6,
      hour: 18,
      recentHistory: historyForEngine(recentTurns),
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
          'Client work matters to him when it feels simple and useful.',
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
