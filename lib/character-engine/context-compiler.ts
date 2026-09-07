export type ContextMessage = {
  role: 'user' | 'companion'
  content: string
}

export type CompiledCompanionContext = {
  historyBlock: string
  memoryBlock: string
  knowledgeBlock: string
  observationBlock: string
  selectedMemoryLines: string[]
  selectedKnowledgeLines: string[]
  lastUser?: string
  lastCompanion?: string
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'also',
  'and',
  'are',
  'because',
  'been',
  'before',
  'being',
  'but',
  'can',
  'could',
  'did',
  'does',
  'for',
  'from',
  'have',
  'her',
  'him',
  'his',
  'how',
  'into',
  'just',
  'mark',
  'more',
  'not',
  'now',
  'out',
  'really',
  'said',
  'she',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'they',
  'this',
  'too',
  'was',
  'were',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'you',
  'your',
])

function tokens(value: string): Set<string> {
  return new Set(
    String(value || '')
      .toLowerCase()
      .replace(/^\s*\d+[.)]\s*/, '')
      .match(/[a-z0-9']{3,}/g)
      ?.map((word) => word.replace(/^'+|'+$/g, ''))
      .filter((word) => word && !STOP_WORDS.has(word)) ?? []
  )
}

function normalizeLine(value: string): string {
  return String(value || '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function lexicalOverlap(query: Set<string>, line: string): number {
  if (!query.size) return 0
  const lineTokens = tokens(line)
  let overlap = 0
  for (const token of query) {
    if (lineTokens.has(token)) overlap += 1
  }
  return overlap
}

/**
 * Existing memory loaders already provide an importance/recency ordering. This
 * compiler keeps that prior while letting the current message pull a few highly
 * relevant items upward. The goal is attention, not maximal context volume.
 */
export function selectRelevantContextLines(opts: {
  currentUserText: string
  lines: string[]
  limit: number
}): string[] {
  const query = tokens(opts.currentUserText)
  const seen = new Set<string>()

  const ranked = opts.lines
    .map((raw, index) => {
      const line = normalizeLine(raw)
      const key = line.toLowerCase()
      const overlap = lexicalOverlap(query, line)
      // Earlier lines from storage are already stronger. Topical overlap can
      // outrank recency, but cannot make a weak duplicate flood the prompt.
      const sourcePrior = Math.max(0, 12 - index) * 0.35
      return { line, key, index, score: overlap * 4 + sourcePrior }
    })
    .filter((item) => item.line)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const selected: typeof ranked = []
  for (const item of ranked) {
    if (selected.length >= opts.limit) break
    if (seen.has(item.key)) continue
    selected.push(item)
    seen.add(item.key)
  }

  // Put selected context back into its original source order. The model should
  // experience it as memory, not as an unexplained relevance leaderboard.
  return selected.sort((a, b) => a.index - b.index).map((item) => item.line)
}

function numberLines(lines: string[], empty: string): string {
  if (!lines.length) return empty
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
}

export function compileCompanionContext(opts: {
  displayName: string
  currentUserText: string
  thread: ContextMessage[]
  memoryLines: string[]
  knowledgeLines: string[]
  absenceNote?: string | null
  privateFocus?: string | null
  curiosity?: string | null
}): CompiledCompanionContext {
  const thread = opts.thread
    .filter((message) => String(message.content || '').trim())
    .slice(-16)

  const historyBlock = thread.length
    ? thread
        .map((message) => {
          const who = message.role === 'user' ? 'Mark' : opts.displayName
          return `${who}: ${String(message.content).trim()}`
        })
        .join('\n')
    : '(Little shared history yet. Do not force intimacy.)'

  const selectedMemoryLines = selectRelevantContextLines({
    currentUserText: opts.currentUserText,
    lines: opts.memoryLines,
    limit: 7,
  })
  const selectedKnowledgeLines = selectRelevantContextLines({
    currentUserText: opts.currentUserText,
    lines: opts.knowledgeLines,
    limit: 6,
  })

  const memoryParts = [...selectedMemoryLines]
  if (opts.absenceNote) memoryParts.push(`(Private continuity) ${opts.absenceNote}`)
  if (opts.curiosity) memoryParts.push(`(Curiosity) ${opts.curiosity}`)
  if (opts.privateFocus) memoryParts.push(`(Her private focus) ${opts.privateFocus}`)

  return {
    historyBlock,
    memoryBlock: numberLines(
      memoryParts,
      '(Nothing stored yet — learn him from what he actually says and does.)'
    ),
    knowledgeBlock: numberLines(
      selectedKnowledgeLines,
      '(She is still learning him. No durable knowledge stored yet.)'
    ),
    // Real-life performance observations now belong to persistent Character
    // State / Organic Recognition. Keeping this block deliberately empty stops
    // the old task-count heuristics from competing with that system.
    observationBlock:
      '(No separate performance observation. Let persistent Character State decide whether anything in his real-life behavior is actually worth mentioning.)',
    selectedMemoryLines,
    selectedKnowledgeLines,
    lastUser: [...thread].reverse().find((message) => message.role === 'user')?.content,
    lastCompanion: [...thread].reverse().find((message) => message.role === 'companion')?.content,
  }
}
