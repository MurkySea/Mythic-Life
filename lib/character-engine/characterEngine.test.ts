import { describe, expect, it } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { decideCharacterResponse } from '@/lib/character-engine/decision'
import { createDefaultCharacterState } from '@/lib/character-engine/state'
import { getCompanionDef } from '@/lib/companions'

describe('Character Engine v2', () => {
  it('treats a correction as repair, not deeper interpretation', () => {
    const analysis = analyzeCharacterMessage("No, you read me wrong. I'm actually in a good mood.")
    const decision = decideCharacterResponse({
      def: getCompanionDef('seraphine'),
      analysis,
      state: createDefaultCharacterState('seraphine'),
    })

    expect(analysis.intent).toBe('correction')
    expect(decision.move).toBe('clarify')
    expect(decision.acknowledgeCorrection).toBe(true)
    expect(decision.askQuestion).toBe(false)
    expect(decision.offerAdvice).toBe(false)
  })

  it('does not automatically offer advice while the user vents', () => {
    const analysis = analyzeCharacterMessage("I'm exhausted and I just need to vent. This whole day sucked.")
    const decision = decideCharacterResponse({
      def: getCompanionDef('seraphine'),
      analysis,
      state: createDefaultCharacterState('seraphine'),
    })

    expect(analysis.intent).toBe('venting')
    expect(decision.offerAdvice).toBe(false)
    expect(['stay', 'comfort', 'observe', 'react']).toContain(decision.move)
  })

  it('selects a momentum move when planning is requested', () => {
    const analysis = analyzeCharacterMessage('Help me plan the next steps and break this down.')
    const decision = decideCharacterResponse({
      def: getCompanionDef('ember_crimsonfall'),
      analysis,
      state: createDefaultCharacterState('ember_crimsonfall'),
    })

    expect(analysis.intent).toBe('planning')
    expect(decision.offerAdvice).toBe(true)
    expect(['challenge', 'encourage', 'care', 'clarify']).toContain(decision.move)
  })

  it('lets low energy soften a challenge response', () => {
    const analysis = analyzeCharacterMessage('Help me plan the next steps and break this down.')
    const state = {
      ...createDefaultCharacterState('ember_crimsonfall'),
      energy: 10,
    }
    const decision = decideCharacterResponse({
      def: getCompanionDef('ember_crimsonfall'),
      analysis,
      state,
    })

    expect(decision.stateInfluence).toContain('low-energy-softened-response')
    expect(decision.move).not.toBe('challenge')
  })
})
