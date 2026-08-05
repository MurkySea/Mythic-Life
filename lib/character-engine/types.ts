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
  | 'honor_contract'
  | 'explore_disclosure'
  | 'stay_present'

export type ConversationMomentum = {
  activeTopic: string
  activeTurns: number
  trajectory: 'opening' | 'steady' | 'deepening' | 'resolving' | 'shifting'
  continueUntil: string[]
}

export type ConversationContract = {
  type: 'turn_taking_questions'
  active: boolean
  nextActor: 'user' | 'companion'
  source: string
}

export type DisclosureAssessment = {
  depth: 1 | 2 | 3 | 4 | 5
  categories: Array<'preference' | 'identity' | 'relationship' | 'fear' | 'childhood' | 'trauma' | 'grief' | 'shame' | 'hope'>
  requiresPause: boolean
  rationale: string[]
}

export type ResponseObligation =
  | 'reflect_specific_meaning'
  | 'validate_without_diagnosing'
  | 'ask_one_grounded_question'
  | 'connect_to_known_pattern'
  | 'offer_quiet_presence'
  | 'fulfill_conversation_contract'

export type ConversationDirection = {
  version: 4
  mode: ConversationMode
  topic: string
  continuity: 'new_turn' | 'continuation'
  emotionalWeight: 'normal' | 'medium' | 'high'
  likelyNeed: CharacterNeed
  goal: string
  objectives: ReplyObjective[]
  momentum: ConversationMomentum
  contract: ConversationContract | null
  disclosure: DisclosureAssessment
  obligations: ResponseObligation[]
  clarificationNeeded: boolean
  responseRequirements: string[]
  avoid: string[]
  responseObligation: string
  primaryMove: 'answer' | 'acknowledge' | 'ask' | 'share' | 'tease' | 'support' | 'challenge' | 'reassure' | 'invite' | 'remain_brief'
  topicSource: 'user_message' | 'current_scene' | 'inner_life' | 'relationship' | 'memory' | 'open_loop'
  selectedTopic?: string
  callbackAllowed: boolean
  callbackReason?: string
  desiredLength: 'very_short' | 'short' | 'medium' | 'long'
  metaphorBudget: 0 | 1 | 2
  prohibitedPatterns: string[]
  newDayDetected: boolean
  sceneStatus: SceneStatus
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
  emotionalSafety: number
  vulnerability: number
  familiarity: number
  protectiveness: number
  independence: number
  dependency: number
  conflictStrain: number
  repairStatus: 'clear' | 'needed' | 'in_progress'
}

export type EvolvingIdentity = {
  confidence: number
  assertiveness: number
  initiative: number
  playfulness: number
  humorComfort: number
  emotionalOpenness: number
  resilience: number
  independence: number
  optimism: number
  willingnessToDisagree: number
  willingnessToAskForHelp: number
  affectionComfort: number
}

export type InnerLifeItem = {
  id: string
  kind: 'interest' | 'project' | 'question' | 'goal' | 'discovery' | 'opinion' | 'preference'
  label: string
  status: 'active' | 'paused' | 'completed'
  salience: number
  updatedAt: string
}

export type DailyInteractionIntent =
  | 'curiosity' | 'playfulness' | 'support' | 'companionship' | 'shared_activity'
  | 'reflection' | 'challenge' | 'celebration' | 'romance' | 'restraint'

export type CompanionDailyState = {
  localDate: string
  mood: { valence: number; energy: number; stress: number; loneliness: number; curiosity: number; confidence: number }
  primaryIntent: DailyInteractionIntent
  secondaryIntent?: DailyInteractionIntent
  activeThoughts: string[]
  activeInterestIds: string[]
  personalGoalFocus?: string
  socialEnergy: number
  conversationalAppetite: number
  poeticLanguageBudget: number
  priorDayTopicCooldowns: string[]
  initializedAt: string
}

export type SceneStatus = 'active' | 'paused' | 'resolved' | 'abandoned' | 'archived'

export type CompanionScene = {
  id: string
  startedAt: string
  localDate: string
  topicIds: string[]
  emotionalPurpose?: string
  unresolvedObligations: string[]
  status: SceneStatus
  closedAt?: string
}

export type DailyReflection = {
  date: string
  meaningfulEvents: Array<{ summary: string; significance: number }>
  relationshipEffects: Partial<Record<keyof CharacterRelationship, number | string>>
  identityEffects: Partial<Record<keyof EvolvingIdentity, number>>
  unresolvedLoops: string[]
  topicsToAvoidAutoContinuing: string[]
  createdAt: string
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
  version: 2
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
  evolvingIdentity: EvolvingIdentity
  innerLife: InnerLifeItem[]
  daily: CompanionDailyState
  scene: CompanionScene
  recentMotifs: string[]
  reflections: DailyReflection[]
  updatedAt: string
}

export type CompanionMemoryType = 'factual' | 'episodic' | 'relational' | 'growth' | 'open_loop' | 'sensitive'

export type CompanionMemory = {
  id: string
  type: CompanionMemoryType
  summary: string
  createdAt: string
  lastRelevantAt?: string
  salience: number
  emotionalWeight: number
  sensitivity: number
  unresolved: boolean
  people: string[]
  topics: string[]
  sourceInteractionId?: string
  retrievalCount: number
  lastRetrievedAt?: string
  cooldownUntil?: string
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
  now?: Date
  timeZone?: string
  memories?: CompanionMemory[]
  random?: () => number
}
