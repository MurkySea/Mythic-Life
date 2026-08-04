import { createClient } from '@/utils/supabase/server'
import type { CharacterAnalysis } from '@/lib/character-engine/types'
import type { DisclosureAssessment } from '@/lib/character-engine/types'

export type CompanionKnowledgeKind =
  | 'value'
  | 'pattern'
  | 'preference'
  | 'fear'
  | 'drive'
  | 'relationship_observation'

export type CompanionKnowledge = {
  kind: CompanionKnowledgeKind
  content: string
  confidence: number
  evidence: string
  source: 'conversation' | 'pattern' | 'rhythm' | 'manual'
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * Distill a short third-person knowledge statement from high-signal user text.
 * Returns null when the turn is not worth permanent knowledge.
 */
export function extractKnowledgeCandidate(opts: {
  userText: string
  analysis: CharacterAnalysis
  disclosure: DisclosureAssessment
}): CompanionKnowledge | null {
  const sourceText = clean(opts.userText || '')
  if (!sourceText || sourceText.length < 16) return null

  const lower = sourceText.toLowerCase()
  const depth = opts.disclosure.depth
  const categories = opts.disclosure.categories

  // Gate: only high-signal turns become knowledge
  const highSignal =
    depth >= 3 ||
    opts.analysis.isVulnerable ||
    categories.some((c) =>
      ['value', 'fear', 'childhood', 'trauma', 'grief', 'shame', 'hope', 'identity'].includes(c)
    ) ||
    /\b(?:i always|i never|i tend to|i'm the kind of|that's just how i|for years|my whole life|what matters to me|i care about|i measure|worthy of)\b/i.test(
      lower
    )

  if (!highSignal) return null

  let kind: CompanionKnowledgeKind = 'pattern'
  let content = ''
  let confidence = 0.55

  // Value / success frame
  if (
    /\b(?:worthy of winning|kind of person|who i want to become|legacy|outlast|matters more than winning)\b/i.test(
      lower
    ) ||
    (/\b(?:success|winning|win)\b/i.test(lower) && /\b(?:person|become|worthy|character)\b/i.test(lower))
  ) {
    kind = 'value'
    content =
      'He measures success by becoming the kind of person worthy of winning, not by the win itself.'
    confidence = 0.85
  }
  // Quiet under pressure
  else if (
    /\b(?:go quiet|go silent|disappear|withdraw|shut down|don't ask for help|rather handle it alone)\b/i.test(
      lower
    )
  ) {
    kind = 'pattern'
    content = 'He tends to go quiet or handle pressure alone rather than ask for help.'
    confidence = 0.8
  }
  // Carries others
  else if (
    /\b(?:everyone else|take care of|carry|support everyone|help everyone|clients first|put others)\b/i.test(
      lower
    )
  ) {
    kind = 'pattern'
    content = 'He defaults to carrying other people; receiving care is harder for him to accept.'
    confidence = 0.78
  }
  // Faith as anchor
  else if (/\b(?:faith|god|church|bible|prayer|worship|kingdom)\b/i.test(lower) && depth >= 2) {
    kind = 'value'
    content = 'Faith is a real anchor for him — not background noise or cultural habit.'
    confidence = 0.82
  }
  // Building / legacy drive
  else if (
    /\b(?:build|building|legacy|homestead|land|something that lasts|outlive me|systems)\b/i.test(lower)
  ) {
    kind = 'drive'
    content = 'He comes alive when building something meant to outlast him.'
    confidence = 0.8
  }
  // Self-neglect / postponed joy
  else if (
    /\b(?:for myself|nothing for me|don't rest|skip rest|postponed|never take time|burned out)\b/i.test(
      lower
    )
  ) {
    kind = 'pattern'
    content = 'He is slow to do things purely for himself; rest and joy get postponed.'
    confidence = 0.78
  }
  // Fear of not being chosen / known
  else if (
    /\b(?:not chosen|never chosen|only tolerated|not really known|nobody sees|love deficient|without affection)\b/i.test(
      lower
    )
  ) {
    kind = 'fear'
    content =
      'Being truly seen and intentionally chosen matters deeply to him — more than praise or performance.'
    confidence = 0.88
  }
  // Preference language
  else if (/\b(?:i prefer|i'd rather|my favorite|i love when|i hate when)\b/i.test(lower) && depth >= 2) {
    kind = 'preference'
    content = distillPreference(sourceText)
    confidence = 0.7
  }
  // Identity / values at depth 4+
  else if (depth >= 4) {
    kind = categories.includes('fear')
      ? 'fear'
      : categories.includes('hope') || categories.includes('identity')
        ? 'value'
        : 'relationship_observation'
    content = distillGeneric(sourceText, kind)
    confidence = 0.65 + Math.min(0.2, (depth - 3) * 0.1)
  }
  // Vulnerable pattern without specific match
  else if (opts.analysis.isVulnerable && sourceText.length >= 40) {
    kind = 'relationship_observation'
    content = distillGeneric(sourceText, kind)
    confidence = 0.62
  } else {
    return null
  }

  if (!content || content.length < 12) return null

  return {
    kind,
    content: content.slice(0, 220),
    confidence: clamp(confidence),
    evidence: sourceText.slice(0, 160),
    source: 'conversation',
  }
}

function distillPreference(text: string): string {
  const cleaned = clean(text)
  // Keep it third-person and short
  if (/\bi prefer\b/i.test(cleaned)) {
    return `He prefers ${cleaned.replace(/^.*?\bi prefer\b\s*/i, '').slice(0, 120)}`.
      replace(/\.$/, '')
      .trim() + '.'
  }
  if (/\bi'd rather\b/i.test(cleaned)) {
    return `He'd rather ${cleaned.replace(/^.*?\bi'd rather\b\s*/i, '').slice(0, 120)}`.
      replace(/\.$/, '')
      .trim() + '.'
  }
  return `A clear preference he stated: ${cleaned.slice(0, 140)}`
}

function distillGeneric(text: string, kind: CompanionKnowledgeKind): string {
  const cleaned = clean(text)
  const core = cleaned.slice(0, 160).replace(/\s+\S*$/, '')
  if (kind === 'fear') return `Something that weighs on him: ${core}`
  if (kind === 'value') return `Something he holds as important: ${core}`
  if (kind === 'drive') return `A drive that showed clearly: ${core}`
  return `He revealed: ${core}`
}

function encodeKnowledge(k: CompanionKnowledge): string {
  // Reuse companion_memories encoding: [type:importance] text
  // importance 1-10 from confidence; type pattern marks durable knowledge
  const importance = Math.max(6, Math.round(k.confidence * 10))
  return `[pattern:${importance}] ${k.content}`
}

function parseKnowledgeContent(raw: string): { text: string; importance: number } {
  const match = raw.match(/^\[(\w+):(\d+)\]\s*([\s\S]*)$/)
  if (match) {
    return {
      importance: Math.min(10, Math.max(1, parseInt(match[2], 10) || 6)),
      text: match[3].trim(),
    }
  }
  return { importance: 6, text: raw.trim() }
}

/** Skip near-duplicates written in the last few days. */
async function recentlyHasSimilar(
  companionSlug: string,
  content: string,
  withinHours = 72
): Promise<boolean> {
  const supabase = await createClient()
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString()
  const key = content.slice(0, 40).toLowerCase()

  try {
    const { data } = await supabase
      .from('companion_memories')
      .select('content')
      .eq('companion_slug', companionSlug)
      .eq('source', 'knowledge')
      .gte('created_at', since)
      .limit(40)

    return (data || []).some((row) => {
      const parsed = parseKnowledgeContent(row.content || '')
      return parsed.text.toLowerCase().includes(key) || key.includes(parsed.text.slice(0, 40).toLowerCase())
    })
  } catch {
    return false
  }
}

export async function maybeWriteKnowledge(opts: {
  companionSlug: string
  userText: string
  analysis: CharacterAnalysis
  disclosure: DisclosureAssessment
}): Promise<CompanionKnowledge | null> {
  const candidate = extractKnowledgeCandidate({
    userText: opts.userText,
    analysis: opts.analysis,
    disclosure: opts.disclosure,
  })
  if (!candidate) return null
  if (candidate.confidence < 0.6) return null

  if (await recentlyHasSimilar(opts.companionSlug, candidate.content)) {
    return null
  }

  const supabase = await createClient()
  try {
    await supabase.from('companion_memories').insert({
      companion_slug: opts.companionSlug,
      content: encodeKnowledge(candidate),
      source: 'knowledge',
    })
    return candidate
  } catch (e) {
    console.error('maybeWriteKnowledge failed', e)
    return null
  }
}

/**
 * Load the highest-signal knowledge entries for prompt injection.
 * Ranked by importance (confidence) then recency.
 */
export async function loadCompanionKnowledge(
  companionSlug: string,
  limit = 8
): Promise<string[]> {
  const supabase = await createClient()

  try {
    const { data } = await supabase
      .from('companion_memories')
      .select('content, created_at, source')
      .eq('companion_slug', companionSlug)
      .eq('source', 'knowledge')
      .order('created_at', { ascending: false })
      .limit(40)

    if (!data || data.length === 0) return []

    const now = Date.now()
    const scored = data.map((row) => {
      const parsed = parseKnowledgeContent(row.content || '')
      const ageDays =
        (now - new Date(row.created_at || now).getTime()) / (1000 * 60 * 60 * 24)
      const recency = Math.max(0, 8 - ageDays / 21)
      const score = parsed.importance * 1.8 + recency
      return { text: parsed.text, score }
    })

    scored.sort((a, b) => b.score - a.score)

    // Dedup near-identical lines
    const selected: string[] = []
    for (const item of scored) {
      if (selected.length >= limit) break
      const key = item.text.slice(0, 36).toLowerCase()
      if (selected.some((s) => s.toLowerCase().includes(key) || key.includes(s.slice(0, 36).toLowerCase()))) {
        continue
      }
      selected.push(item.text)
    }

    return selected
  } catch (e) {
    console.error('loadCompanionKnowledge failed', e)
    return []
  }
}

export function formatKnowledgeBlock(lines: string[]): string {
  if (!lines.length) {
    return '(She is still learning him. No durable knowledge stored yet — learn from what he actually says and does.)'
  }
  return lines.map((line, i) => `${i + 1}. ${line}`).join('\n')
}
