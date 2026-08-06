import type { CompanionDef } from '@/lib/companions'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { characterEnginePromptBlock } from '@/lib/character-engine/compiler'
import { decideCharacterResponse } from '@/lib/character-engine/decision'
import { directConversation } from '@/lib/character-engine/director'
import { createDefaultCharacterState } from '@/lib/character-engine/state'
import type {
  CharacterDecision,
  CharacterEngineContext,
  CharacterState,
  ConversationDirection,
} from '@/lib/character-engine/types'
import type { CuriosityIntent } from '@/lib/character-engine/curiosity'
import { detectMotifs, localDateFor, retrieveRelevantMemories, rollDailyBoundary } from '@/lib/character-engine/living'

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
  relevantMemories: import('@/lib/character-engine/types').CompanionMemory[]
  observability: {
    newDayDetected: boolean
    sceneStatus: string
    dailyIntent: string
    selectedTopicSource: string
    retrievedMemoryIds: string[]
    callbackAuthorized: boolean
    callbackReason?: string
    topicCooldownsApplied: string[]
    motifPenaltiesApplied: string[]
  }
} {
  const analysis = analyzeCharacterMessage(opts.userText)
  const now = opts.now ?? new Date()
  const initialState = opts.state ?? createDefaultCharacterState(opts.companionSlug, now, opts.timeZone)
  const boundary = rollDailyBoundary(initialState, now, opts.timeZone)
  const carriedOpenLoops = boundary.state.scene.unresolvedObligations.map((summary, index) => ({
    id: `scene-open-loop-${index}`,
    type: 'open_loop' as const,
    summary,
    createdAt: boundary.state.scene.startedAt,
    salience: 0.85,
    emotionalWeight: 0.5,
    sensitivity: 0.2,
    unresolved: true,
    people: [],
    topics: [],
    retrievalCount: 0,
  }))
  const recentCompanionLines = String(opts.recentHistory || '').split('\n')
    .filter((line) => !line.toLowerCase().startsWith('mark:'))
  const recentMotifs = opts.companionSlug === 'seraphine' ? detectMotifs(recentCompanionLines) : []
  let state: CharacterState = { ...boundary.state, recentMotifs }
  if (boundary.newDayDetected) {
    state = {
      ...state,
      scene: {
        id: `${opts.companionSlug}:${localDateFor(now, opts.timeZone)}`,
        startedAt: now.toISOString(), localDate: localDateFor(now, opts.timeZone),
        topicIds: [], unresolvedObligations: [], status: 'active',
      },
    }
  }
  const selected = retrieveRelevantMemories({
    memories: [...carriedOpenLoops, ...(opts.memories ?? [])], userText: opts.userText, now,
    newDayDetected: boundary.newDayDetected,
    topicCooldowns: state.daily.priorDayTopicCooldowns,
  })
  const direction = directConversation({
    userText: opts.userText,
    recentHistory: opts.recentHistory,
    analysis,
    state,
    newDayDetected: boundary.newDayDetected,
    relevantMemories: selected.map((item) => item.memory),
  })
  const decision = decideCharacterResponse({ def: opts.def, analysis, state })

  return {
    analysis,
    direction,
    decision,
    state,
    relevantMemories: selected.map((item) => item.memory),
    observability: {
      newDayDetected: boundary.newDayDetected,
      sceneStatus: state.scene.status,
      dailyIntent: state.daily.primaryIntent,
      selectedTopicSource: direction.topicSource,
      retrievedMemoryIds: selected.map((item) => item.memory.id),
      callbackAuthorized: direction.callbackAllowed,
      callbackReason: direction.callbackReason,
      topicCooldownsApplied: state.daily.priorDayTopicCooldowns,
      motifPenaltiesApplied: recentMotifs,
    },
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
export * from '@/lib/character-engine/compiler'
export * from '@/lib/character-engine/curiosity'
export * from '@/lib/character-engine/decision'
export * from '@/lib/character-engine/director'
export * from '@/lib/character-engine/generation-loop'
export * from '@/lib/character-engine/knowledge'
export * from '@/lib/character-engine/identity'
export * from '@/lib/character-engine/living'
export * from '@/lib/character-engine/evaluation'
export * from '@/lib/character-engine/memory'
export * from '@/lib/character-engine/persistence'
export * from '@/lib/character-engine/quality'
export * from '@/lib/character-engine/state'
export * from '@/lib/character-engine/types'
