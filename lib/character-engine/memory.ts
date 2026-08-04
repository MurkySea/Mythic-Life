import type { CharacterAnalysis } from '@/lib/character-engine/types'

export type CompanionMemoryKind =
  | 'fact'
  | 'preference'
  | 'promise'
  | 'milestone'
  | 'vulnerability'
  | 'conflict'
  | 'inside_joke'
  | 'relationship'

export type CompanionMemoryCandidate = {
  kind: CompanionMemoryKind
  summary: string
  importance: number
  confidence: number
  sourceText: string
  tags: string[]
  expiresAt?: string
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

function detectKind(text: string, analysis: CharacterAnalysis): CompanionMemoryKind {
  const lower = text.toLowerCase()

  if (/\b(?:i promise|i will|i'll|remind me|don't let me forget|do not let me forget)\b/.test(lower)) {
    return 'promise'
  }
  if (/\b(?:i love|i hate|my favorite|i prefer|i don't like|i do not like)\b/.test(lower)) {
    return 'preference'
  }
  if (/\b(?:passed|won|finished|graduated|anniversary|birthday|got promoted|bought|moved)\b/.test(lower)) {
    return 'milestone'
  }
  if (analysis.isVulnerable) return 'vulnerability'
  if (analysis.isCorrection || /\b(?:argument|fight|angry at you|upset with you)\b/.test(lower)) return 'conflict'
  if (/\b(?:inside joke|remember when|that joke|our joke)\b/.test(lower)) return 'inside_joke'
  if (/\b(?:trust you|miss you|love you|care about you|proud of you)\b/.test(lower)) return 'relationship'
  return 'fact'
}

function baseImportance(kind: CompanionMemoryKind): number {
  switch (kind) {
    case 'promise':
      return 82
    case 'milestone':
      return 78
    case 'vulnerability':
      return 76
    case 'conflict':
      return 72
    case 'relationship':
      return 70
    case 'preference':
      return 58
    case 'inside_joke':
      return 56
    default:
      return 42
  }
}

export function scoreMemoryCandidate(opts: {
  userText: string
  analysis: CharacterAnalysis
  explicitRememberRequest?: boolean
}): CompanionMemoryCandidate | null {
  const sourceText = clean(opts.userText || '')
  if (!sourceText || sourceText.length < 8) return null

  const lower = sourceText.toLowerCase()
  const explicitRememberRequest =
    opts.explicitRememberRequest || /\b(?:remember this|remember that|don't forget|do not forget)\b/.test(lower)
  const kind = detectKind(sourceText, opts.analysis)

  let importance = baseImportance(kind)
  let confidence = opts.analysis.confidence * 100

  if (explicitRememberRequest) {
    importance = Math.max(82, importance + 18)
    confidence += 12
  }
  if (sourceText.length >= 80) importance += 4
  if (sourceText.length >= 180) importance += 3
  if (opts.analysis.isVulnerable) importance += 5
  if (opts.analysis.isCorrection) confidence += 8

  importance = clamp(importance)
  confidence = clamp(confidence)

  // Ordinary conversational fragments should not become permanent memories.
  if (!explicitRememberRequest && kind === 'fact' && importance < 50) return null

  const tags: string[] = [kind]
  if (opts.analysis.intent !== 'unknown') tags.push(`intent:${opts.analysis.intent}`)
  if (opts.analysis.need !== 'unknown') tags.push(`need:${opts.analysis.need}`)

  return {
    kind,
    summary: sourceText.slice(0, 280),
    importance,
    confidence,
    sourceText,
    tags,
  }
}

export function shouldPersistMemory(candidate: CompanionMemoryCandidate | null): boolean {
  return Boolean(candidate && candidate.importance >= 55 && candidate.confidence >= 55)
}
