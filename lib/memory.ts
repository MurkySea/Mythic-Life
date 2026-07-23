import { createClient } from '@/utils/supabase/server'

export type MemoryType = 'episodic' | 'pattern' | 'relational' | 'private'

export type StoredMemory = {
  id?: string
  companion_slug: string
  content: string
  type: MemoryType
  importance: number // 1–10
  source: string
  created_at?: string
}

/**
 * Heuristic importance + type classification for a user message.
 * Designed to catch moments that should persist across weeks/months.
 */
export function classifyMemory(userText: string): {
  shouldStore: boolean
  type: MemoryType
  importance: number
  summary: string
} | null {
  const t = (userText || '').trim()
  if (t.length < 12) return null

  const lower = t.toLowerCase()

  // High-signal personal / emotional
  const highPersonal =
    /\b(i feel|i felt|i'm scared|i am scared|i'm afraid|i miss|i love|i need|i can't|i'm tired of|i hate that|i wish|i always|i never|it hurts|i'm struggling|i'm drowning|i'm lost)\b/i.test(
      lower
    )

  // Life pattern / identity signals
  const patternSignal =
    /\b(every day|every week|lately|these days|i keep|i always end up|i never seem|i'm the kind of|that's just how i|for years|since i was)\b/i.test(
      lower
    )

  // Relational / bond signals
  const relationalSignal =
    /\b(with you|when we|you and i|our|i trust you|i don't trust|you matter|you noticed|you remembered|don't leave|stay|i'm glad you're|i need you)\b/i.test(
      lower
    )

  // Concrete life facts worth keeping
  const lifeFact =
    /\b(my wife|lauren|work|office|edward jones|fishing|church|bible|piano|land|homestead|sleep|pcos|hashimoto|clients|backlog)\b/i.test(
      lower
    )

  // Promises / commitments
  const promise =
    /\b(i will|i'll|i promise|i'm going to|from now on|starting today|i decided|i choose)\b/i.test(lower)

  let importance = 3
  let type: MemoryType = 'episodic'

  if (highPersonal) {
    importance = 8
    type = 'episodic'
  }
  if (relationalSignal) {
    importance = Math.max(importance, 7)
    type = 'relational'
  }
  if (patternSignal) {
    importance = Math.max(importance, 7)
    type = 'pattern'
  }
  if (lifeFact) {
    importance = Math.max(importance, 6)
    type = 'episodic'
  }
  if (promise) {
    importance = Math.max(importance, 7)
    type = 'episodic'
  }

  // Length and specificity bump
  if (t.length > 80) importance = Math.min(10, importance + 1)
  if (t.length > 160) importance = Math.min(10, importance + 1)

  // Only store if it clears a meaningful threshold
  if (importance < 5 && !lifeFact) return null

  // Create a clean, first-person or observational summary suitable for long-term storage
  let summary = t.slice(0, 320).trim()
  if (summary.length === 320) summary = summary.replace(/\s+\S*$/, '') + '…'

  return {
    shouldStore: true,
    type,
    importance,
    summary,
  }
}

/**
 * Store a memory. Uses existing companion_memories table.
 * Content is prefixed with metadata so retrieval can still work
 * even if the table schema is minimal (no type/importance columns yet).
 */
export async function storeMemory(opts: {
  companionSlug: string
  content: string
  type: MemoryType
  importance: number
  source?: string
}): Promise<void> {
  const { companionSlug, content, type, importance, source = 'conversation' } = opts
  if (!content.trim()) return

  const supabase = await createClient()

  // Encode type + importance in the content for schema-light deployments
  // Format: [type:importance] actual memory text
  const encoded = `[${type}:${importance}] ${content.trim()}`

  try {
    await supabase.from('companion_memories').insert({
      companion_slug: companionSlug,
      content: encoded,
      source,
    })
  } catch (e) {
    console.error('storeMemory failed', e)
  }
}

/**
 * Parse encoded memory content back into structured form.
 */
function parseEncoded(raw: string): { type: MemoryType; importance: number; text: string } {
  const match = raw.match(/^\[(\w+):(\d+)\]\s*(.*)$/s)
  if (match) {
    const type = (['episodic', 'pattern', 'relational', 'private'].includes(match[1])
      ? match[1]
      : 'episodic') as MemoryType
    const importance = Math.min(10, Math.max(1, parseInt(match[2], 10) || 5))
    return { type, importance, text: match[3].trim() }
  }
  return { type: 'episodic', importance: 5, text: raw.trim() }
}

/**
 * Retrieve the best memories for a companion.
 * Mixes: high-importance, recent, and type diversity.
 * Designed so meaningful moments can surface months later.
 */
export async function loadBestMemories(
  companionSlug: string,
  limit = 14
): Promise<string[]> {
  const supabase = await createClient()

  try {
    // Pull a larger window so we can rank
    const { data } = await supabase
      .from('companion_memories')
      .select('content, created_at, source')
      .eq('companion_slug', companionSlug)
      .order('created_at', { ascending: false })
      .limit(80)

    if (!data || data.length === 0) return []

    const now = Date.now()
    const scored = data.map((row) => {
      const parsed = parseEncoded(row.content || '')
      const ageDays =
        (now - new Date(row.created_at || now).getTime()) / (1000 * 60 * 60 * 24)

      // Recency score decays slowly so old high-importance memories still surface
      const recency = Math.max(0, 10 - ageDays / 14) // ~ full score for 2 weeks, gradual after
      const score = parsed.importance * 1.6 + recency

      return {
        text: parsed.text,
        type: parsed.type,
        importance: parsed.importance,
        score,
        ageDays,
      }
    })

    // Sort by score, then diversify a bit by type
    scored.sort((a, b) => b.score - a.score)

    const selected: typeof scored = []
    const typeCount: Record<string, number> = {}

    for (const m of scored) {
      if (selected.length >= limit) break
      const count = typeCount[m.type] || 0
      // Allow more episodic, limit pure pattern spam
      if (m.type === 'pattern' && count >= 3) continue
      if (m.type === 'private' && count >= 2) continue
      selected.push(m)
      typeCount[m.type] = count + 1
    }

    // Format for the prompt: clean, numbered, with light type hint only when useful
    return selected.map((m, i) => {
      const ageHint =
        m.ageDays > 21
          ? ' (some time ago)'
          : m.ageDays > 7
            ? ' (recent weeks)'
            : ''
      return `${i + 1}. ${m.text}${ageHint}`
    })
  } catch (e) {
    console.error('loadBestMemories failed', e)
    return []
  }
}

/**
 * Convenience: classify + store in one call after a user message.
 */
export async function maybeCaptureMemory(
  companionSlug: string,
  userText: string
): Promise<void> {
  const result = classifyMemory(userText)
  if (!result || !result.shouldStore) return

  await storeMemory({
    companionSlug,
    content: result.summary,
    type: result.type,
    importance: result.importance,
    source: 'conversation',
  })
}

/**
 * Store a companion-originated private or relational memory
 * (e.g. "She noticed he disappeared for three days").
 */
export async function storeCompanionObservation(opts: {
  companionSlug: string
  content: string
  importance?: number
}): Promise<void> {
  await storeMemory({
    companionSlug: opts.companionSlug,
    content: opts.content,
    type: 'private',
    importance: opts.importance ?? 6,
    source: 'companion_observation',
  })
}
