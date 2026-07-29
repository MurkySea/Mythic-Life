import type { CompanionDef } from '@/lib/companions'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { characterEnginePromptBlock } from '@/lib/character-engine/compiler'
import { decideCharacterResponse } from '@/lib/character-engine/decision'
import { createDefaultCharacterState } from '@/lib/character-engine/state'
import type {
  CharacterDecision,
  CharacterEngineContext,
  CharacterState,
} from '@/lib/character-engine/types'

export function runCharacterEngine(opts: CharacterEngineContext & { def?: CompanionDef }): {
  analysis: ReturnType<typeof analyzeCharacterMessage>
  decision: CharacterDecision
  state: CharacterState
  promptBlock: string
} {
  const analysis = analyzeCharacterMessage(opts.userText)
  const state = opts.state ?? createDefaultCharacterState(opts.companionSlug)
  const decision = decideCharacterResponse({ def: opts.def, analysis, state })

  return {
    analysis,
    decision,
    state,
    promptBlock: characterEnginePromptBlock({ analysis, decision, state }),
  }
}

export * from '@/lib/character-engine/analysis'
export * from '@/lib/character-engine/compiler'
export * from '@/lib/character-engine/decision'
export * from '@/lib/character-engine/memory'
export * from '@/lib/character-engine/persistence'
export * from '@/lib/character-engine/state'
export * from '@/lib/character-engine/types'
