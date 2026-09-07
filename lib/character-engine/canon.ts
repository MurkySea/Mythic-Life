import type { CharacterState, CompanionCanonFact } from '@/lib/character-engine/types'

const MAX_CANON_FACTS = 16

function clean(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function stableId(statement: string): string {
  const input = clean(statement).toLowerCase()
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `canon:self:${(hash >>> 0).toString(36)}`
}

function sentenceList(text: string): string[] {
  return (clean(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

const DURABLE_SELF_DISCLOSURE =
  /^(?:well,?\s*)?(?:i\s+(?:learned|grew up|was born|used to|trained|studied|worked|served|lived|came from|come from|have|had|can|cannot|can't|love|hate|prefer)\b|i(?:'m| am)\s+(?:from|good at|bad at|afraid of|fond of|terrible at|skilled at)\b|my\s+(?:family|mother|father|home|teacher|mentor|work|training|childhood|favorite|least favorite)\b)/i

const SHARED_HISTORY_MARKER =
  /\b(?:you|your|we|our|us|together|remember|again|as usual|like old times|used to with you)\b/i

const TRANSIENT_SELF_STATE =
  /^i\s+(?:think|feel|want|wonder|hope|guess|suppose|miss|need|wish|know|don't know|do not know)\b/i

/**
 * Pull only durable first-person facts the companion herself established.
 * Anything that claims a shared past with Mark is intentionally excluded here.
 */
export function extractCompanionCanonFacts(reply: string, now = new Date()): CompanionCanonFact[] {
  const createdAt = now.toISOString()
  return sentenceList(reply)
    .filter((sentence) => sentence.length >= 10 && sentence.length <= 220)
    .filter((sentence) => DURABLE_SELF_DISCLOSURE.test(sentence))
    .filter((sentence) => !TRANSIENT_SELF_STATE.test(sentence))
    .filter((sentence) => !SHARED_HISTORY_MARKER.test(sentence))
    .map((statement) => ({
      id: stableId(statement),
      statement,
      source: 'companion_statement' as const,
      createdAt,
      lastConfirmedAt: createdAt,
    }))
}

function similarityKey(text: string): string {
  return clean(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 8)
    .join(' ')
}

export function updateCompanionCanonFromReply(
  state: CharacterState,
  reply?: string | null,
  now = new Date()
): CharacterState {
  if (!reply) return state
  const incoming = extractCompanionCanonFacts(reply, now)
  if (!incoming.length) return state

  const current = state.companionCanon?.selfFacts ?? []
  const facts = [...current]

  for (const candidate of incoming) {
    const key = similarityKey(candidate.statement)
    const index = facts.findIndex((fact) => {
      const other = similarityKey(fact.statement)
      return fact.id === candidate.id || (key && other && (key.includes(other) || other.includes(key)))
    })

    if (index >= 0) {
      facts[index] = {
        ...facts[index],
        lastConfirmedAt: candidate.lastConfirmedAt,
      }
    } else {
      facts.push(candidate)
    }
  }

  facts.sort((a, b) => b.lastConfirmedAt.localeCompare(a.lastConfirmedAt))
  return {
    ...state,
    companionCanon: {
      version: 1,
      selfFacts: facts.slice(0, MAX_CANON_FACTS),
    },
    updatedAt: now.toISOString(),
  }
}

export function formatCompanionCanon(state?: CharacterState): string {
  const facts = state?.companionCanon?.selfFacts ?? []
  if (!facts.length) {
    return '(No extra self-lore has been established in conversation yet.)'
  }

  return `${facts
    .slice(0, 6)
    .map((fact, index) => `${index + 1}. ${fact.statement}`)
    .join('\n')}\nThese are things she previously established about herself. Keep them consistent. They do not imply Mark was present for them or already knew them.`
}

export function recognitionAppearsInReply(summary: string, reply?: string | null): boolean {
  if (!summary || !reply) return false
  const stopwords = new Set([
    'that', 'this', 'with', 'from', 'have', 'been', 'more', 'than', 'your', 'you', 'mark', 'week',
    'noticed', 'seems', 'looks', 'really', 'just', 'into', 'about', 'some', 'what', 'when', 'there',
  ])
  const important = clean(summary)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stopwords.has(token))
  if (!important.length) return false

  const haystack = new Set(
    clean(reply)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4)
  )
  const overlap = important.filter((token) => haystack.has(token)).length
  return overlap >= Math.min(2, important.length) || overlap / important.length >= 0.35
}
