import { extractKnowledgeCandidate, type CompanionKnowledgeKind } from '@/lib/character-engine/knowledge'
import type {
  CharacterAnalysis,
  CharacterState,
  DisclosureAssessment,
  UserBelief,
  UserBeliefCategory,
  UserTheory,
} from '@/lib/character-engine/types'

const MAX_BELIEFS = 18
const MAX_EVIDENCE = 5

const STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'been', 'being', 'could', 'from', 'have',
  'into', 'just', 'like', 'mark', 'more', 'really', 'said', 'something', 'that', 'their', 'them',
  'there', 'these', 'they', 'this', 'those', 'very', 'want', 'what', 'when', 'where', 'which',
  'while', 'with', 'would', 'your', 'youre', 'you', 'he', 'his', 'him', 'the', 'and', 'but', 'for',
  'not', 'are', 'was', 'were', 'has', 'had', 'does', 'did', 'its', 'im', 'ive', 'ill', 'id', 'my',
])

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function clean(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function tokens(text: string): Set<string> {
  return new Set(
    clean(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, ' ')
      .split(/\s+/)
      .map((token) => token.replace(/'/g, ''))
      .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  )
}

function similarity(a: string, b: string): number {
  const aa = tokens(a)
  const bb = tokens(b)
  if (!aa.size || !bb.size) return 0
  let overlap = 0
  for (const token of aa) if (bb.has(token)) overlap += 1
  return overlap / Math.max(aa.size, bb.size)
}

function stableId(category: string, statement: string): string {
  const input = `${category}:${clean(statement).toLowerCase()}`
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `belief:${category}:${(hash >>> 0).toString(36)}`
}

function categoryFromKnowledge(kind: CompanionKnowledgeKind): UserBeliefCategory {
  switch (kind) {
    case 'value': return 'value'
    case 'preference': return 'preference'
    case 'fear': return 'fear'
    case 'drive': return 'drive'
    case 'relationship_observation': return 'relationship'
    default: return 'pattern'
  }
}

function explicitCandidate(text: string): {
  category: UserBeliefCategory
  statement: string
  confidence: number
} | null {
  const source = clean(text)
  if (source.length < 10 || source.length > 420) return null

  if (/\b(?:i prefer|i'd rather|my favorite|i love when|i hate when|i really love|i really hate)\b/i.test(source)) {
    return { category: 'preference', statement: `Mark explicitly stated: ${source}`, confidence: 0.9 }
  }
  if (/\b(?:what matters to me|i care about|important to me|i believe|my values?)\b/i.test(source)) {
    return { category: 'value', statement: `Mark explicitly stated: ${source}`, confidence: 0.9 }
  }
  if (/\b(?:i want to|i'm trying to|i am trying to|my goal is|i hope to|i'm building|i am building)\b/i.test(source)) {
    return { category: 'drive', statement: `A current aim Mark stated: ${source}`, confidence: 0.86 }
  }
  if (/\b(?:i'm the kind of|i am the kind of|i see myself as|that's who i am|that is who i am)\b/i.test(source)) {
    return { category: 'identity', statement: `Mark described himself this way: ${source}`, confidence: 0.88 }
  }
  if (/\b(?:i tend to|i usually|i always|i never|for years i|my whole life i)\b/i.test(source)) {
    return { category: 'pattern', statement: `A pattern Mark described: ${source}`, confidence: 0.78 }
  }
  return null
}

function initialTheory(state: CharacterState): UserTheory {
  return state.theoryOfUser ?? { version: 1, beliefs: [] }
}

function contradictionCue(text: string, analysis: CharacterAnalysis): boolean {
  if (!analysis.isCorrection) return false
  return /\b(?:no|actually|not true|that's wrong|that is wrong|don't|do not|never|isn't|is not|aren't|are not)\b/i.test(text)
}

function reviseContradictedBelief(
  theory: UserTheory,
  userText: string,
  analysis: CharacterAnalysis,
  observedAt: string
): UserTheory {
  if (!contradictionCue(userText, analysis) || !theory.beliefs.length) return theory

  let bestIndex = -1
  let bestScore = 0
  theory.beliefs.forEach((belief, index) => {
    const score = similarity(belief.statement, userText)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })
  if (bestIndex < 0 || bestScore < 0.22) return theory

  const beliefs = [...theory.beliefs]
  const belief = beliefs[bestIndex]
  beliefs[bestIndex] = {
    ...belief,
    confidence: clamp(belief.confidence * 0.58),
    status: 'revised',
    evidence: [
      ...belief.evidence,
      { quote: clean(userText).slice(0, 220), observedAt, stance: 'contradict' as const },
    ].slice(-MAX_EVIDENCE),
    lastObservedAt: observedAt,
  }
  return { ...theory, beliefs }
}

export function updateTheoryOfUser(opts: {
  state: CharacterState
  userText: string
  analysis: CharacterAnalysis
  disclosure: DisclosureAssessment
  now?: Date
}): CharacterState {
  const now = opts.now ?? new Date()
  const observedAt = now.toISOString()
  let theory = reviseContradictedBelief(
    initialTheory(opts.state),
    opts.userText,
    opts.analysis,
    observedAt
  )

  const knowledge = extractKnowledgeCandidate({
    userText: opts.userText,
    analysis: opts.analysis,
    disclosure: opts.disclosure,
  })
  const explicit = explicitCandidate(opts.userText)
  const candidate = knowledge
    ? {
        category: categoryFromKnowledge(knowledge.kind),
        statement: knowledge.content,
        confidence: knowledge.confidence,
      }
    : explicit

  if (!candidate) {
    return theory === opts.state.theoryOfUser ? opts.state : { ...opts.state, theoryOfUser: theory }
  }

  const evidence = clean(opts.userText).slice(0, 220)
  let bestIndex = -1
  let bestScore = 0
  theory.beliefs.forEach((belief, index) => {
    if (belief.category !== candidate.category) return
    const score = similarity(belief.statement, candidate.statement)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  const beliefs = [...theory.beliefs]
  if (bestIndex >= 0 && bestScore >= 0.48) {
    const current = beliefs[bestIndex]
    const hasSameEvidence = current.evidence.some((item) => similarity(item.quote, evidence) >= 0.8)
    const nextEvidence = hasSameEvidence
      ? current.evidence
      : [...current.evidence, { quote: evidence, observedAt, stance: 'support' as const }].slice(-MAX_EVIDENCE)
    const confidence = hasSameEvidence
      ? Math.max(current.confidence, candidate.confidence)
      : clamp(Math.max(current.confidence, candidate.confidence) + (1 - current.confidence) * 0.14)

    beliefs[bestIndex] = {
      ...current,
      statement: candidate.confidence > current.confidence + 0.08 ? candidate.statement : current.statement,
      confidence,
      status: confidence >= 0.8 || nextEvidence.filter((item) => item.stance === 'support').length >= 2
        ? 'supported'
        : current.status === 'revised'
          ? 'tentative'
          : current.status,
      evidence: nextEvidence,
      lastObservedAt: observedAt,
    }
  } else {
    beliefs.push({
      id: stableId(candidate.category, candidate.statement),
      category: candidate.category,
      statement: candidate.statement.slice(0, 260),
      confidence: clamp(candidate.confidence),
      status: candidate.confidence >= 0.82 ? 'supported' : 'tentative',
      evidence: [{ quote: evidence, observedAt, stance: 'support' }],
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
    })
  }

  beliefs.sort((a, b) => b.confidence - a.confidence || b.lastObservedAt.localeCompare(a.lastObservedAt))
  theory = { version: 1, beliefs: beliefs.slice(0, MAX_BELIEFS) }
  return { ...opts.state, theoryOfUser: theory, updatedAt: observedAt }
}

export function selectRelevantUserBeliefs(
  state: CharacterState | undefined,
  topic: string,
  limit = 4
): UserBelief[] {
  const beliefs = state?.theoryOfUser?.beliefs ?? []
  if (!beliefs.length) return []
  const topicTokens = tokens(topic)

  return beliefs
    .map((belief) => {
      const overlap = [...tokens(belief.statement)].filter((token) => topicTokens.has(token)).length
      const recencyDays = Math.max(0, (Date.now() - new Date(belief.lastObservedAt).getTime()) / 86_400_000)
      const recency = Math.max(0, 0.18 - recencyDays / 180)
      const score = belief.confidence + Math.min(0.45, overlap * 0.15) + recency
      return { belief, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map(({ belief }) => belief)
}

export function formatTheoryOfUser(state: CharacterState | undefined, topic: string): string {
  const beliefs = selectRelevantUserBeliefs(state, topic, 4)
  if (!beliefs.length) return '(No durable theory yet. Learn from what Mark actually says; do not fill gaps.)'

  const lines = beliefs.map((belief, index) => {
    const certainty = belief.status === 'supported'
      ? 'supported'
      : belief.status === 'revised'
        ? 'recently challenged'
        : 'tentative'
    return `${index + 1}. [${certainty}, ${Math.round(belief.confidence * 100)}%] ${belief.statement}`
  })

  return `${lines.join('\n')}\nThese are working hypotheses, not unquestionable facts. Mark's current words always outrank them. If he contradicts one, believe the correction immediately rather than defending the old model.`
}
