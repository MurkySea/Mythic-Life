import type { CharacterResponseMove } from '@/lib/characterStudio'

export type CharacterIntent =
  | 'greeting'
  | 'venting'
  | 'advice'
  | 'celebration'
  | 'planning'
  | 'reflection'
  | 'humor'
  | 'flirting'
  | 'correction'
  | 'company'
  | 'unknown'

export type CharacterNeed =
  | 'be_heard'
  | 'clarity'
  | 'encouragement'
  | 'momentum'
  | 'celebration'
  | 'company'
  | 'play'
  | 'repair'
  | 'space'
  | 'unknown'

export type CharacterMood =
  | 'soft'
  | 'warm'
  | 'tired'
  | 'sharp'
  | 'distant'
  | 'playful'
  | 'guarded'
  | 'hungry_for_him'

export type ConversationMode =
  | 'conversation'
  | 'comfort'
  | 'company'
  | 'guided_clarity'
  | 'problem_solving'
  | 'celebration'
  | 'play'
  | 'repair'

export type ReplyObjective =
  | 'acknowledge'
  | 'comfort'
  | 'deepen_trust'
  | 'encourage'
  | 'challenge'
  | 'celebrate'
  | 'play'
  | 'flirt'
  | 'protect'
  | 'inspire'
  | 'reflect'
  | 'clarify'
  | 'offer_next_step'
  | 'share_self'

export type ConversationMomentum = {
  activeTopic: string
  activeTurns: number
  trajectory: 'opening' | 'steady' | 'deepening' | 'resolving' | 'shifting'
  continueUntil: string[]
}

export type ConversationDirection = {
  version: 2
  mode: ConversationMode
  topic: string
  continuity: 'new_turn' | 'continuation'
  emotionalWeight: 'normal' | 'medium' | 'high'
  likelyNeed: CharacterNeed
  goal: string
  objectives: ReplyObjective[]
  momentum: ConversationMomentum
  clarificationNeeded: boolean
  responseRequirements: string[]
  avoid: string[]
}

export type CharacterRelationship = {
  version: 1
  trust: number
  comfort: number
  respect: number
  playfulness: number
  admiration: number
  romance: number
  conflict: number
  sharedHistory: number
}

export type CharacterGoal = {
  id: string
  label: string
  progress: number
  status: 'active' | 'paused' | 'completed'
}

export type CharacterThought = {
  id: string
  topic: string
  summary: string
  importance: number
  createdAt: string
  resolvedAt?: string
}

export type CharacterState = {
  version: 1
  companionSlug: string
  mood: CharacterMood
  energy: number
  stress: number
  curiosity: number
  confidence: number
  currentGoals: CharacterGoal[]
  unresolvedThoughts: CharacterThought[]
  recentEvents: string[]
  relationship: CharacterRelationship
  updatedAt: string
}

export type CharacterAnalysis = {
  intent: CharacterIntent
  need: CharacterNeed
  confidence: number
  isVulnerable: boolean
  isCorrection: boolean
  isExplicitAdviceRequest: boolean
  isExplicitFlirtation: boolean
  asksQuestion: boolean
}

export type CharacterDecision = {
  move: CharacterResponseMove
  secondaryMove?: CharacterResponseMove
  askQuestion: boolean
  offerAdvice: boolean
  acknowledgeCorrection: boolean
  rememberCandidate: boolean
  stateInfluence: string[]
  reasoningCode: string[]
}

export type CharacterEngineContext = {
  companionSlug: string
  userText: string
  affinity: number
  hour: number
  state?: CharacterState
  recentHistory?: string
}
