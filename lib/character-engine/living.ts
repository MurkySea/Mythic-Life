import type {
  CompanionDailyState,
  CompanionMemory,
  CompanionScene,
  CharacterState,
  DailyInteractionIntent,
} from '@/lib/character-engine/types'

export const SERAPHINE_MOTIFS: Record<string, RegExp> = {
  quiet: /\b(?:quiet|quieter|silence|stillness|soft|softly)\b/i,
  light: /\b(?:light|shadow|warmth|ember|flame)\b/i,
  carrying: /\b(?:old shape|belong|breathe|carrying|linger)\b/i,
  atmosphere: /\b(?:window|forest|rain|home)\b/i,
}

const INTENTS: DailyInteractionIntent[] = [
  'curiosity', 'playfulness', 'companionship', 'shared_activity', 'reflection',
  'challenge', 'celebration', 'restraint',
]

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

function unit(seed: string): number {
  return hash(seed) / 0xffffffff
}

export function localDateFor(now: Date, timeZone = 'America/Chicago'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function initializeDailyState(opts: {
  companionSlug: string
  now: Date
  timeZone?: string
  previous?: CompanionDailyState
  priorTopics?: string[]
  activeInterestIds?: string[]
}): CompanionDailyState {
  const localDate = localDateFor(opts.now, opts.timeZone)
  if (opts.previous?.localDate === localDate) return opts.previous
  const seed = `${opts.companionSlug}:${localDate}`
  const primaryIndex = Math.floor(unit(`${seed}:intent`) * INTENTS.length)
  const primaryIntent = INTENTS[primaryIndex]
  const secondaryIntent = INTENTS[(primaryIndex + 3) % INTENTS.length]
  const carry = opts.previous?.mood
  return {
    localDate,
    mood: {
      valence: Math.round(((carry?.valence ?? 58) * 0.25) + (45 + unit(`${seed}:valence`) * 30) * 0.75),
      energy: Math.round(((carry?.energy ?? 65) * 0.3) + (45 + unit(`${seed}:energy`) * 40) * 0.7),
      stress: Math.round(((carry?.stress ?? 22) * 0.25) + (8 + unit(`${seed}:stress`) * 30) * 0.75),
      loneliness: Math.round(8 + unit(`${seed}:loneliness`) * 28),
      curiosity: Math.round(42 + unit(`${seed}:curiosity`) * 38),
      confidence: Math.round(48 + unit(`${seed}:confidence`) * 32),
    },
    primaryIntent,
    secondaryIntent,
    activeThoughts: [],
    activeInterestIds: (opts.activeInterestIds ?? []).slice(0, 3),
    socialEnergy: Math.round(40 + unit(`${seed}:social`) * 45),
    conversationalAppetite: Math.round(38 + unit(`${seed}:appetite`) * 46),
    poeticLanguageBudget: primaryIntent === 'reflection' ? 1 : 0,
    priorDayTopicCooldowns: [...new Set(opts.priorTopics ?? [])].slice(0, 6),
    initializedAt: opts.now.toISOString(),
  }
}

export function rollDailyBoundary(state: CharacterState, now: Date, timeZone = 'America/Chicago'): {
  state: CharacterState
  newDayDetected: boolean
} {
  const date = localDateFor(now, timeZone)
  if (state.daily.localDate === date) return { state, newDayDetected: false }
  const previousTopics = state.scene.topicIds
  const hasOpenLoop = state.scene.unresolvedObligations.length > 0
  const scene: CompanionScene = hasOpenLoop
    ? { ...state.scene, status: 'paused', closedAt: now.toISOString() }
    : { ...state.scene, status: 'archived', closedAt: now.toISOString() }
  const daily = initializeDailyState({
    companionSlug: state.companionSlug,
    now,
    timeZone,
    previous: state.daily,
    priorTopics: previousTopics,
    activeInterestIds: state.innerLife.filter((item) => item.status === 'active').map((item) => item.id),
  })
  const reflection = {
    date: state.daily.localDate,
    meaningfulEvents: state.recentEvents.slice(-4).map((summary, index) => ({
      summary,
      significance: Math.max(0.4, 0.7 - index * 0.08),
    })),
    relationshipEffects: {},
    identityEffects: {},
    unresolvedLoops: state.scene.unresolvedObligations,
    topicsToAvoidAutoContinuing: previousTopics,
    createdAt: now.toISOString(),
  }
  return {
    newDayDetected: true,
    state: {
      ...state,
      energy: daily.mood.energy,
      stress: daily.mood.stress,
      curiosity: daily.mood.curiosity,
      confidence: daily.mood.confidence,
      daily,
      scene,
      reflections: [...state.reflections, reflection].slice(-30),
      recentEvents: state.recentEvents.slice(-4),
      updatedAt: now.toISOString(),
    },
  }
}

export function detectMotifs(texts: string[]): string[] {
  return Object.entries(SERAPHINE_MOTIFS)
    .filter(([, pattern]) => texts.filter((text) => pattern.test(text)).length >= 2)
    .map(([motif]) => motif)
}

export function isGenericGreeting(text: string): boolean {
  return /^(?:good\s+)?(?:morning|afternoon|evening)|^(?:hi|hey|hello)[.!\s]*$/i.test(text.trim())
}

export function explicitlyRequestsCallback(text: string): boolean {
  return /\b(?:last night|yesterday|what we talked about|we discussed|you remember|remind me|following up|back to)\b/i.test(text)
}

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9']{4,}/g) ?? []).filter((word) => !['that', 'this', 'with', 'have', 'from', 'what', 'your', 'about'].includes(word)))
}

export function retrieveRelevantMemories(opts: {
  memories: CompanionMemory[]
  userText: string
  now: Date
  newDayDetected: boolean
  topicCooldowns?: string[]
  max?: number
}): Array<{ memory: CompanionMemory; score: number }> {
  if (isGenericGreeting(opts.userText)) {
    return opts.memories
      .filter((memory) => memory.type === 'open_loop' && memory.unresolved && memory.sensitivity < 0.5)
      .slice(0, 1)
      .map((memory) => ({ memory, score: 0.7 }))
  }
  const current = tokens(opts.userText)
  const explicit = explicitlyRequestsCallback(opts.userText)
  const cooldowns = new Set(opts.topicCooldowns ?? [])
  return opts.memories
    .map((memory) => {
      const remembered = tokens(`${memory.summary} ${memory.topics.join(' ')}`)
      const overlap = [...current].filter((word) => remembered.has(word)).length
      const semanticRelevance = overlap / Math.max(2, Math.min(current.size, remembered.size))
      const currentContextFit = overlap > 0 ? 1 : 0
      const unresolvedImportance = memory.unresolved ? 1 : 0
      const sensitivePenalty = memory.type === 'sensitive' || memory.sensitivity >= 0.65 ? (explicit ? 0.12 : 0.58) : 0
      const repeatPenalty = Math.min(0.3, memory.retrievalCount * 0.06)
      const cooling = memory.topics.some((topic) => cooldowns.has(topic)) ? 0.28 : 0
      const newDayPenalty = opts.newDayDetected && !memory.unresolved && !explicit ? 0.32 : 0
      const inCooldown = memory.cooldownUntil && new Date(memory.cooldownUntil) > opts.now ? 0.35 : 0
      const score = semanticRelevance * 0.45 + unresolvedImportance * 0.2 + currentContextFit * 0.15 + (explicit ? 0.3 : 0) + memory.salience * 0.1 + memory.emotionalWeight * 0.1 - sensitivePenalty - repeatPenalty - cooling - newDayPenalty - inCooldown
      return { memory, score }
    })
    .filter((item) => item.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, Math.min(opts.max ?? 1, 2)))
}

export function legacyMemory(summary: string, index: number, now = new Date()): CompanionMemory {
  const sensitive = /\b(?:trauma|abuse|abandon|unloved|health|diagnos|assault|grief)\b/i.test(summary)
  const open = /\b(?:remind|tomorrow|unfinished|follow up|tell you later|promise)\b/i.test(summary)
  const relational = /\b(?:between us|our relationship|trusts? (?:me|her)|feels safe|pulls away|repairs?)\b/i.test(summary)
  const growth = /\b(?:learning|practicing|working on|trying to|getting better|growth|habit)\b/i.test(summary)
  const factual = /\b(?:prefers?|likes?|dislikes?|favorite|works? (?:as|at)|lives? (?:in|at)|birthday|allergic)\b/i.test(summary)
  return {
    id: `legacy-${index}-${hash(summary)}`,
    type: sensitive ? 'sensitive' : open ? 'open_loop' : relational ? 'relational' : growth ? 'growth' : factual ? 'factual' : 'episodic',
    summary,
    createdAt: now.toISOString(),
    salience: open ? 0.8 : 0.55,
    emotionalWeight: sensitive ? 0.8 : 0.4,
    sensitivity: sensitive ? 0.9 : 0.2,
    unresolved: open,
    people: [], topics: [...tokens(summary)].slice(0, 5), retrievalCount: 0,
  }
}

export function selectInnerLifeInitiative(state: CharacterState, userText: string): string | undefined {
  if (/\b(?:urgent|help me now|emergency|what should i do|need advice|hurt|scared|overwhelmed)\b/i.test(userText)) return undefined
  if (state.daily.socialEnergy < 45 || state.daily.primaryIntent === 'restraint') return undefined
  return state.innerLife.find((item) => item.status === 'active' && item.salience >= 45)?.label
}
