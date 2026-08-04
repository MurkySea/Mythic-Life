import type {
  CharacterAnalysis,
  CharacterState,
  ConversationDirection,
} from '@/lib/character-engine/types'

export type AttentionEvidenceType =
  | 'unfinished_thread'
  | 'remembered_value'
  | 'remembered_preference'
  | 'noticed_change'
  | 'recognized_pattern'
  | 'recognized_progress'

export type AttentionMove =
  | 'gentle_callback'
  | 'tailored_response'
  | 'recognize_change'
  | 'return_to_thread'

export type AttentionIntent = {
  active: boolean
  evidence: string | null
  evidenceType: AttentionEvidenceType | null
  relevance: number
  reason: string
  recommendedMove: AttentionMove | null
}

const MIN_RELEVANCE = 0.58
const MIN_OCCURRENCE_CHANCE = 0.12
const MAX_OCCURRENCE_CHANCE = 0.28

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'been', 'being', 'could', 'from', 'have', 'just',
  'like', 'more', 'really', 'said', 'that', 'their', 'there', 'they', 'this',
  'very', 'want', 'were', 'what', 'when', 'with', 'would', 'your',
])

const CONCEPTS: RegExp[] = [
  /\b(?:faith|god|church|prayer|worship|bible)\b/i,
  /\b(?:build|building|business|homestead|legacy|system|client)\b/i,
  /\b(?:rest|sleep|tired|break|recover|recharge)\b/i,
  /\b(?:win|winning|success|worthy|character|become)\b/i,
  /\b(?:family|wife|lauren|marriage|home)\b/i,
  /\b(?:music|piano|fishing|favorite|prefer)\b/i,
  /\b(?:learn|study|read|knowledge|book)\b/i,
]

const STICKY_PATTERN =
  /\b(?:go(?:es)? quiet|withdraw|pressure alone|chosen|tolerated|trauma|abandon|nobody sees|receiving care)\b/i

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function tokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .toLowerCase()
      .match(/[a-z0-9']{4,}/g)
      ?.filter((token) => !STOP_WORDS.has(token)) ?? []
  )
}

function relevanceBetween(current: string, evidence: string): number {
  const currentTokens = tokens(current)
  const evidenceTokens = tokens(evidence)
  const overlap = [...currentTokens].filter((token) => evidenceTokens.has(token)).length
  const lexical = overlap / Math.max(2, Math.min(currentTokens.size, evidenceTokens.size))
  const conceptMatch = CONCEPTS.some(
    (concept) => concept.test(current) && concept.test(evidence)
  )

  return Math.min(1, Math.max(lexical, conceptMatch ? 0.72 + overlap * 0.05 : 0))
}

function latestCompanionReply(history: string): string {
  return normalize(history)
    ? history
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !/^(?:mark|user)\s*:/i.test(line))
        .map((line) => line.replace(/^[^:]+:\s*/, ''))
        .at(-1) ?? ''
    : ''
}

function priorUserTurns(history: string, current: string): string[] {
  const normalizedCurrent = normalize(current).toLowerCase()
  return history
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:mark|user)\s*:/i.test(line))
    .map((line) => normalize(line.replace(/^(?:mark|user)\s*:\s*/i, '')))
    .filter((line) => line && line.toLowerCase() !== normalizedCurrent)
    .slice(-8)
}

function knowledgeType(line: string, current: string): AttentionEvidenceType {
  if (/\b(?:prefers|rather|favorite|preference)\b/i.test(line)) {
    return 'remembered_preference'
  }
  if (/\b(?:important|matters|faith|value|worthy|success)\b/i.test(line)) {
    return 'remembered_value'
  }
  if (/\b(?:always|never|tends|defaults|pattern|carries|every detail)\b/i.test(line)) {
    return 'recognized_pattern'
  }
  if (/\b(?:finally|better|progress|kept|returned|consistent|finished)\b/i.test(current)) {
    return 'recognized_progress'
  }
  if (/\b(?:now|lately|different|instead|used to)\b/i.test(current)) {
    return 'noticed_change'
  }
  return 'recognized_pattern'
}

function userExplicitlyNamedPattern(text: string): boolean {
  return /\b(?:i always|i never|i tend to|i keep|again|same pattern|still doing|usually)\b/i.test(
    text
  )
}

function moveFor(type: AttentionEvidenceType): AttentionMove {
  if (type === 'unfinished_thread') return 'return_to_thread'
  if (type === 'remembered_preference') return 'tailored_response'
  if (type === 'noticed_change' || type === 'recognized_progress') return 'recognize_change'
  return 'gentle_callback'
}

function explicitRequestOrQuestion(text: string, analysis: CharacterAnalysis): boolean {
  return (
    analysis.asksQuestion ||
    analysis.isExplicitAdviceRequest ||
    /\b(?:can you|could you|would you|please|help me|tell me|give me|show me)\b/i.test(text)
  )
}

export function assessEvidenceOfAttention(opts: {
  companionSlug: string
  currentUserMessage: string
  recentHistory: string
  knowledgeLines: string[]
  analysis: CharacterAnalysis
  direction: ConversationDirection
  affinity: number
  state?: CharacterState
  curiosityActive?: boolean
  random?: () => number
}): AttentionIntent {
  const inactive: AttentionIntent = {
    active: false,
    evidence: null,
    evidenceType: null,
    relevance: 0,
    reason: '',
    recommendedMove: null,
  }

  if (opts.companionSlug !== 'seraphine') return inactive
  if (opts.analysis.isCorrection) return inactive
  if (opts.direction.disclosure.depth >= 4 && opts.direction.disclosure.requiresPause) {
    return inactive
  }
  if (opts.direction.contract?.active) return inactive
  if (opts.curiosityActive) return inactive
  if (explicitRequestOrQuestion(opts.currentUserMessage, opts.analysis)) return inactive

  const latestReply = latestCompanionReply(opts.recentHistory)
  const candidates: Array<{
    evidence: string
    evidenceType: AttentionEvidenceType
    relevance: number
  }> = []

  for (const evidence of priorUserTurns(opts.recentHistory, opts.currentUserMessage)) {
    if (STICKY_PATTERN.test(evidence)) continue
    const relevance = relevanceBetween(opts.currentUserMessage, evidence)
    if (relevance >= MIN_RELEVANCE) {
      candidates.push({ evidence, evidenceType: 'unfinished_thread', relevance: relevance + 0.08 })
    }
  }

  for (const rawLine of opts.knowledgeLines) {
    const evidence = normalize(rawLine)
    if (!evidence || STICKY_PATTERN.test(evidence)) continue
    const relevance = relevanceBetween(opts.currentUserMessage, evidence)
    if (relevance >= MIN_RELEVANCE) {
      const evidenceType = knowledgeType(evidence, opts.currentUserMessage)
      if (
        evidenceType === 'recognized_pattern' &&
        !userExplicitlyNamedPattern(opts.currentUserMessage)
      ) {
        continue
      }
      candidates.push({
        evidence,
        evidenceType,
        relevance,
      })
    }
  }

  candidates.sort((a, b) => b.relevance - a.relevance)
  const selected = candidates[0]
  if (!selected) return inactive

  // Do not repeat an idea Seraphine just used, even if it remains relevant.
  if (relevanceBetween(latestReply, selected.evidence) >= MIN_RELEVANCE) return inactive

  const relevance = Math.min(1, selected.relevance)
  const affinityLift = Math.min(0.04, Math.max(0, opts.affinity - 4) * 0.005)
  const attentionStat = (opts.state?.curiosity ?? 55) / 100
  const occurrenceChance = Math.max(
    MIN_OCCURRENCE_CHANCE,
    Math.min(MAX_OCCURRENCE_CHANCE, 0.08 + relevance * 0.16 + attentionStat * 0.04 + affinityLift)
  )
  if ((opts.random ?? Math.random)() >= occurrenceChance) {
    return { ...inactive, relevance }
  }

  return {
    active: true,
    evidence: selected.evidence,
    evidenceType: selected.evidenceType,
    relevance,
    reason:
      selected.evidenceType === 'unfinished_thread'
        ? 'The current turn directly reconnects to something Mark left unfinished recently.'
        : 'A fact Seraphine retained is directly relevant to what Mark is saying now.',
    recommendedMove: moveFor(selected.evidenceType),
  }
}

export function formatAttentionBlock(intent: AttentionIntent): string {
  if (!intent.active || !intent.evidence || !intent.evidenceType) return ''

  return [
    `Remembered or noticed: ${intent.evidence}`,
    `Evidence type: ${intent.evidenceType}`,
    `Why it fits now: ${intent.reason}`,
    `Suggested move: ${intent.recommendedMove}`,
    'Let this color one natural phrase or choice. Do not recite the stored wording, announce that you remembered it, diagnose Mark, or add a second callback.',
    "Answer Mark's literal message first; this evidence is supporting context, never the main agenda.",
  ].join('\n')
}
