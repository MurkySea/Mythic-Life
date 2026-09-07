import type { CompanionDef } from '@/lib/companions'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { characterEnginePromptBlock } from '@/lib/character-engine/compiler'
import {
  attachCharacterState,
  getAttachedCharacterState,
  loadCharacterCognition,
  persistConversationCognition,
} from '@/lib/character-engine/cognition'
import { decideCharacterResponse } from '@/lib/character-engine/decision'
import { directConversation } from '@/lib/character-engine/director'
import {
  loadCompanionKnowledge as loadCompanionKnowledgeBase,
  maybeWriteKnowledge as maybeWriteKnowledgeBase,
} from '@/lib/character-engine/knowledge'
import { createDefaultCharacterState } from '@/lib/character-engine/state'
import type {
  CharacterDecision,
  CharacterEngineContext,
  CharacterState,
  ConversationDirection,
} from '@/lib/character-engine/types'
import type { CuriosityIntent } from '@/lib/character-engine/curiosity'

/**
 * Preserve the existing durable-knowledge API while quietly attaching the
 * companion's persistent cognition to the returned lines.
 */
export async function loadCompanionKnowledge(
  ...args: Parameters<typeof loadCompanionKnowledgeBase>
): Promise<string[]> {
  const [companionSlug, , options] = args
  let state: CharacterState | undefined

  try {
    state = await loadCharacterCognition(companionSlug)
  } catch (error) {
    console.error('loadCharacterCognition failed', error)
    if (options?.throwOnError) throw error
  }

  const lines = await loadCompanionKnowledgeBase(...args)
  return attachCharacterState(lines, state)
}

/**
 * Every conversation advances Character State; only high-signal turns continue
 * through the existing durable-knowledge writer.
 */
export async function maybeWriteKnowledge(
  ...args: Parameters<typeof maybeWriteKnowledgeBase>
): ReturnType<typeof maybeWriteKnowledgeBase> {
  const [opts] = args
  try {
    await persistConversationCognition(opts)
  } catch (error) {
    console.error('persistConversationCognition failed', error)
  }
  return maybeWriteKnowledgeBase(...args)
}

export function runCharacterEngine(opts: CharacterEngineContext & {
  def?: CompanionDef
  knowledgeLines?: string[]
  curiosity?: CuriosityIntent
}): {
  analysis: ReturnType<typeof analyzeCharacterMessage>
  direction: ConversationDirection
  decision: CharacterDecision
  state: CharacterState
  promptBlock: string
} {
  const analysis = analyzeCharacterMessage(opts.userText)
  const direction = directConversation({
    userText: opts.userText,
    recentHistory: opts.recentHistory,
    analysis,
  })
  const state =
    opts.state ??
    getAttachedCharacterState(opts.knowledgeLines) ??
    createDefaultCharacterState(opts.companionSlug)
  const decision = decideCharacterResponse({ def: opts.def, analysis, state })

  return {
    analysis,
    direction,
    decision,
    state,
    promptBlock: characterEnginePromptBlock({
      analysis,
      direction,
      decision,
      state,
      curiosity: opts.curiosity,
    }),
  }
}

export * from '@/lib/character-engine/analysis'
export * from '@/lib/character-engine/attention'
export * from '@/lib/character-engine/canon'
export * from '@/lib/character-engine/cognition'
export * from '@/lib/character-engine/compiler'
export * from '@/lib/character-engine/context-compiler'
export * from '@/lib/character-engine/curiosity'
export * from '@/lib/character-engine/decision'
export * from '@/lib/character-engine/director'
export * from '@/lib/character-engine/generation-loop'
export * from '@/lib/character-engine/knowledge'
export * from '@/lib/character-engine/memory'
export * from '@/lib/character-engine/organic-recognition'
export * from '@/lib/character-engine/persistence'
export * from '@/lib/character-engine/quality'
export * from '@/lib/character-engine/state'
export * from '@/lib/character-engine/theory-of-user'
export * from '@/lib/character-engine/types'
