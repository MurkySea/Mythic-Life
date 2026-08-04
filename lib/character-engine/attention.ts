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

export type AttentionRecentTurn = {
  role: 'user' | 'companion'
  content: string
}

const MIN_RELEVANCE = 0.58
const MIN_OCCURRENCE_CHANCE = 0.12
const MAX_OCCURRENCE_CHANCE = 0.28

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'been', 'being', 'could', 'from', 'have', 'just',
  'like', 'more', 'really', 'said', 'that', 'their', 'there', 'they', 'this',
  'very', 'want', 'were', 'what', 'when', 'with', 'would', 'your',
])

const CONCEPTS: Array<{ id: string; forms: RegExp[] }> = [
  { id: 'onboarding', forms: [/\bonboarding\b/i] },
  { id: 'retirement', forms: [/\bretirement\b/i] },
  { id: 'homestead', forms: [/\bhomestead\b/i, /\bacreage\b/i] },
  { id: 'piano', forms: [/\bpiano\b/i, /\bmusic practice\b/i, /\bpractic(?:e|ing) music\b/i] },
  { id: 'fishing', forms: [/\bfish(?:ing)?\b/i] },
  { id: 'sleep_rest', forms: [/\bsleep\b/i, /\btired\b/i, /\brest(?:ed|ing)?\b/i] },
  { id: 'spouse', forms: [/\bwif(?:e|ey)\b/i, /\blauren\b/i, /\bmy marriage\b/i] },
  { id: 'book_reading', forms: [/\bbooks?\b/i, /\bread(?:ing)?\b/i] },
  { id: 'study', forms: [/\bstud(?:y|ied|ying)\b/i] },
  { id: 'faith', forms: [/\bfaith\b/i, /\bprayer\b/i, /\bchurch\b/i] },
  { id: 'winning', forms: [/\bwin(?:ning)?\b/i, /\bworthy of winning\b/i] },
]

const RECENT_COMPANION_WINDOW = 4

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
  const currentConcepts = new Set(
    CONCEPTS.filter((concept) => concept.forms.some((form) => form.test(current))).map(
      (concept) => concept.id
    )
  )
  const conceptMatch = CONCEPTS.some(
    (concept) =>
      currentConcepts.has(concept.id) &&
      concept.forms.some((form) => form.test(evidence))
  )

  return Math.min(1, Math.max(lexical, conceptMatch ? 0.72 + overlap * 0.05 : 0))
}

function recentCompanionReplies(turns: AttentionRecentTurn[]): string[] {
  return turns
    .filter((turn) => turn.role === 'companion')
    .slice(-RECENT_COMPANION_WINDOW)
    .map((turn) => normalize(turn.content))
}

function priorUserTurns(turns: AttentionRecentTurn[], current: string): string[] {
  const normalizedCurrent = normalize(current).toLowerCase()
  return turns
    .filter((turn) => turn.role === 'user')
    .map((turn) => normalize(turn.content))
    .filter((line) => line && line.toLowerCase() !== normalizedCurrent)
    .slice(-8)
}

function isSensitiveEvidence(text: string): boolean {
  const value = normalize(text).toLowerCase()
  return [
    /\btrauma(?:tic)?\b|\bchildhood\b.{0,30}\b(?:abuse|abused|violence|hurt)\b|\babus(?:e|ed)\b.{0,30}\b(?:child|young)\b/,
    /\bsexual\b.{0,20}\babus(?:e|ed)\b|\bmolest(?:ed|ation)?\b|\b(?:sexual )?assault(?:ed)?\b|\brap(?:e|ed)\b/,
    /\b(?:chosen|choose him)\b.{0,30}\b(?:tolerated|wanted|loved)\b|\b(?:tolerated|settled for)\b.{0,30}\bchosen\b/,
    /\b(?:useful|valuable|worth(?:y)?)\b.{0,45}\b(?:help|helping|carry|doing|serve)\b|\b(?:help|helping|carry|doing|serve)\b.{0,45}\b(?:useful|valuable|worth(?:y)?)\b|\bneeded only\b/,
    /\babandon(?:ed|ment)?\b|\b(?:fear|afraid|scared)\b.{0,30}\b(?:people )?leav(?:e|ing)\b|\beveryone leaves\b/,
    /\b(?:carry|carrying|handle|handling)\b.{0,35}\b(?:pressure|everything|it)\b.{0,20}\balone\b|\bpressure\b.{0,35}\balone\b/,
    /\bnot (?:feel )?(?:wanted|loved)\b|\bunwanted\b|\bunlovable\b|\bwithout (?:love|affection)\b/,
    /\b(?:hard|difficult|struggle|struggles|cannot|can't)\b.{0,35}\b(?:receive|receiving|accept)\b.{0,25}\b(?:love|care|affection)\b|\breceiving (?:love|care)\b.{0,25}\b(?:hard|difficult)\b/,
  ].some((pattern) => pattern.test(value))
}

function knowledgeType(line: string, current: string): AttentionEvidenceType {
  if (/\b(?:prefers|rather|favorite|preference)\b/i.test(line)) {
    return 'remembered_preference'
  }
  if (/\b(?:important|matters|faith|value|worthy|success)\b/i.test(line)) {
    return 'remembered_value'
  }
  if (/\b(?:wife|lauren|marriage)\b/i.test(line)) return 'remembered_value'
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
  recentTurns: AttentionRecentTurn[]
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
  if (opts.direction.disclosure.depth >= 4) return inactive
  if (opts.direction.contract?.active) return inactive
  if (opts.curiosityActive) return inactive
  if (explicitRequestOrQuestion(opts.currentUserMessage, opts.analysis)) return inactive

  const recentReplies = recentCompanionReplies(opts.recentTurns)
  const candidates: Array<{
    evidence: string
    evidenceType: AttentionEvidenceType
    relevance: number
    recency: number
  }> = []

  for (const [recency, evidence] of priorUserTurns(
    opts.recentTurns,
    opts.currentUserMessage
  ).entries()) {
    if (isSensitiveEvidence(evidence)) continue
    const relevance = relevanceBetween(opts.currentUserMessage, evidence)
    if (relevance >= MIN_RELEVANCE) {
      candidates.push({
        evidence,
        evidenceType: 'unfinished_thread',
        relevance: relevance + 0.08,
        recency,
      })
    }
  }

  for (const rawLine of opts.knowledgeLines) {
    const evidence = normalize(rawLine)
    if (!evidence || isSensitiveEvidence(evidence)) continue
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
        recency: -1,
      })
    }
  }

  candidates.sort(
    (a, b) => b.relevance - a.relevance || b.recency - a.recency
  )
  const selected = candidates[0]
  if (!selected) return inactive

  // Do not repeat an idea Seraphine used in her recent reply window.
  if (
    recentReplies.some(
      (reply) => relevanceBetween(reply, selected.evidence) >= MIN_RELEVANCE
    )
  ) {
    return inactive
  }

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
