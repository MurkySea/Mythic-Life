import { describe, expect, it } from 'vitest'
import {
  assessCuriosityIntent,
  characterEnginePromptBlock,
  runCharacterEngine,
} from '@/lib/character-engine'
import { buildCompanionUserPrompt } from '@/lib/companionVoice'
import { getCompanionDef } from '@/lib/companions'

const eligible = {
  companionSlug: 'seraphine',
  knowledgeLines: [] as string[],
  affinity: 4,
  disclosureDepth: 1,
  isCorrection: false,
  isVulnerable: false,
  userTextLength: 28,
}

describe('Seraphine conversational curiosity', () => {
  it('never activates for Nyx or another non-Seraphine companion', () => {
    for (const companionSlug of ['nyx', 'kira_foxveil']) {
      const intent = assessCuriosityIntent({
        ...eligible,
        companionSlug,
        random: () => 0,
      })

      expect(intent.active).toBe(false)
      expect(intent.gaps).toEqual([])
    }
  })

  it('can leave an eligible gap inactive when the occurrence roll misses', () => {
    expect(
      assessCuriosityIntent({ ...eligible, random: () => 0.99 }).active
    ).toBe(false)
  })

  it('activates an eligible gap when the occurrence roll is favorable', () => {
    expect(
      assessCuriosityIntent({ ...eligible, random: () => 0 }).active
    ).toBe(true)
  })

  it('suppresses another curiosity move after the recent companion reply asked a question', () => {
    expect(
      assessCuriosityIntent({
        ...eligible,
        recentCompanionText: 'What part of the work actually felt like yours?',
        random: () => 0,
      }).active
    ).toBe(false)
  })

  it('keeps corrections and significant disclosures as hard overrides', () => {
    expect(
      assessCuriosityIntent({
        ...eligible,
        isCorrection: true,
        random: () => 0,
      }).active
    ).toBe(false)
    expect(
      assessCuriosityIntent({
        ...eligible,
        disclosureDepth: 4,
        random: () => 0,
      }).active
    ).toBe(false)
  })

  it('includes the curiosity heading exactly once when active and zero times when inactive', () => {
    const def = getCompanionDef('seraphine')
    const engine = runCharacterEngine({
      companionSlug: 'seraphine',
      userText: 'Work was ordinary today.',
      affinity: 4,
      hour: 18,
      recentHistory: '',
      def,
      knowledgeLines: [],
    })

    const buildPrompt = (active: boolean) =>
      buildCompanionUserPrompt({
        displayName: 'Seraphine',
        isConversation: true,
        triggerText: 'Work was ordinary today.',
        mood: 'warm',
        engine: {
          direction: engine.direction,
          promptBlock: characterEnginePromptBlock({
            analysis: engine.analysis,
            decision: engine.decision,
            direction: engine.direction,
            state: engine.state,
            curiosity: active
              ? assessCuriosityIntent({ ...eligible, random: () => 0 })
              : undefined,
          }),
        },
      })

    expect(buildPrompt(true).match(/CURIOSITY ABOUT HIM/g)).toHaveLength(1)
    expect(buildPrompt(false).match(/CURIOSITY ABOUT HIM/g) ?? []).toHaveLength(0)
  })
})
