import type { CharacterState } from '@/lib/character-engine/types'
import type { CompanionKnowledgeKind } from '@/lib/character-engine/knowledge'

export type CuriosityDepth = 'light' | 'pattern' | 'deep'

export type CuriosityMove = 'question' | 'return_to_thread' | 'soft_observation'

export type KnowledgeGap = {
  kind: CompanionKnowledgeKind | 'ordinary_life'
  label: string
  severity: number // 0–1, higher = more missing / more desired
}

export type CuriosityIntent = {
  active: boolean
  depth: CuriosityDepth
  target: string
  reason: string
  suggestedMove: CuriosityMove
  priority: number
  gaps: KnowledgeGap[]
}

/** Facets Seraphine is drawn to learn about Mark as closeness grows. */
const SERAPHINE_TARGETS: {
  kind: KnowledgeGap['kind']
  label: string
  match: RegExp
  deepOnly?: boolean
}[] = [
  {
    kind: 'value',
    label: 'what he measures a life by',
    match: /worthy of winning|kind of person|legacy|faith is a real anchor|holds as important|values/,
  },
  {
    kind: 'fear',
    label: 'what he is afraid of failing at or never being',
    match: /truly seen|intentionally chosen|weighs on him|afraid|never chosen|only tolerated/,
    deepOnly: true,
  },
  {
    kind: 'pattern',
    label: 'how he handles pressure and whether he lets himself need anyone',
    match: /go quiet|handle pressure alone|carrying other people|receiving care|postponed|for himself/,
  },
  {
    kind: 'drive',
    label: 'what he is building that is meant to outlast him',
    match: /outlast him|building something|homestead|legacy/,
  },
  {
    kind: 'preference',
    label: 'ordinary preferences and what actually rests him',
    match: /prefers|rather|favorite|love when|hate when/,
  },
  {
    kind: 'relationship_observation',
    label: 'how he experiences being known by someone who stays',
    match: /revealed:|being known|chosen|relationship/,
    deepOnly: true,
  },
  {
    kind: 'ordinary_life',
    label: 'the texture of his ordinary days — not tasks, the person inside them',
    match: /fishing|piano|sleep|office|clients|church|wife|lauren/,
  },
]

function inferKindsFromLines(lines: string[]): Set<string> {
  const found = new Set<string>()
  for (const line of lines) {
    const lower = line.toLowerCase()
    for (const target of SERAPHINE_TARGETS) {
      if (target.match.test(lower)) found.add(target.kind)
    }
  }
  return found
}

/**
 * Bond stage from affinity (mirrors relationshipStage bands loosely).
 * Early < 4, forming 4–9, close >= 10
 */
function bondBand(affinity: number): 'early' | 'forming' | 'close' {
  if (affinity >= 10) return 'close'
  if (affinity >= 4) return 'forming'
  return 'early'
}

function depthForBand(band: 'early' | 'forming' | 'close'): CuriosityDepth {
  if (band === 'close') return 'deep'
  if (band === 'forming') return 'pattern'
  return 'light'
}

/**
 * Build ordered knowledge gaps for this companion given what she already knows.
 */
export function computeKnowledgeGaps(opts: {
  companionSlug: string
  knowledgeLines: string[]
  affinity: number
}): KnowledgeGap[] {
  // Seraphine first; other companions get a generic light set later
  const targets =
    opts.companionSlug === 'seraphine' || !opts.companionSlug
      ? SERAPHINE_TARGETS
      : SERAPHINE_TARGETS.filter((t) => !t.deepOnly)

  const known = inferKindsFromLines(opts.knowledgeLines)
  const band = bondBand(opts.affinity)
  const gaps: KnowledgeGap[] = []

  for (const target of targets) {
    if (target.deepOnly && band === 'early') continue

    const has = known.has(target.kind)
    let severity = has ? 0.2 : 0.75

    // Closeness increases desire to fill remaining gaps
    if (band === 'forming') severity += 0.1
    if (band === 'close') severity += 0.2
    if (!has && target.kind === 'fear' && band === 'close') severity += 0.1
    if (!has && target.kind === 'value') severity += 0.05

    // Ordinary life always has some residual curiosity
    if (target.kind === 'ordinary_life') severity = has ? 0.35 : 0.55

    severity = Math.max(0, Math.min(1, severity))
    if (severity < 0.35) continue

    gaps.push({
      kind: target.kind,
      label: target.label,
      severity,
    })
  }

  gaps.sort((a, b) => b.severity - a.severity)
  return gaps
}

/**
 * Decide whether this turn should carry a soft curiosity move.
 * Never forces interrogation; stays quiet on high disclosure / repair / exhaustion.
 */
export function assessCuriosityIntent(opts: {
  companionSlug: string
  knowledgeLines: string[]
  affinity: number
  state?: CharacterState
  disclosureDepth?: number
  isCorrection?: boolean
  isVulnerable?: boolean
  userTextLength?: number
}): CuriosityIntent {
  const gaps = computeKnowledgeGaps({
    companionSlug: opts.companionSlug,
    knowledgeLines: opts.knowledgeLines,
    affinity: opts.affinity,
  })

  const band = bondBand(opts.affinity)
  const depth = depthForBand(band)
  const top = gaps[0]

  const empty: CuriosityIntent = {
    active: false,
    depth,
    target: '',
    reason: '',
    suggestedMove: 'soft_observation',
    priority: 0,
    gaps,
  }

  // Hard suppress: repair, deep disclosure, heavy vulnerability this turn
  if (opts.isCorrection) return empty
  if ((opts.disclosureDepth ?? 1) >= 4) return empty
  if (opts.isVulnerable && (opts.userTextLength ?? 0) >= 80) return empty

  // State: low energy / high stress → less probing
  const curiosityStat = opts.state?.curiosity ?? 55
  const energy = opts.state?.energy ?? 70
  const stress = opts.state?.stress ?? 20
  const trust = opts.state?.relationship.trust ?? 20

  if (energy <= 28 || stress >= 78) return empty

  if (!top) return empty

  // Probability-like priority: closeness + gap severity + curiosity stat
  let priority = top.severity * 0.55
  priority += (curiosityStat / 100) * 0.25
  priority += band === 'close' ? 0.15 : band === 'forming' ? 0.08 : 0.02
  priority += trust >= 40 ? 0.05 : 0

  // Early bond: only light curiosity, lower priority
  if (band === 'early' && top.kind !== 'ordinary_life' && top.kind !== 'preference') {
    priority *= 0.45
  }

  // Need a meaningful bar so it is not every turn
  const active = priority >= 0.42 && gaps.length > 0

  if (!active) {
    return { ...empty, priority }
  }

  let suggestedMove: CuriosityMove = 'soft_observation'
  if (band === 'close' && top.severity >= 0.7) suggestedMove = 'question'
  else if (band === 'forming' && top.severity >= 0.65) suggestedMove = 'question'
  else if (opts.knowledgeLines.length > 0 && top.severity >= 0.6) suggestedMove = 'return_to_thread'

  const reason =
    band === 'close'
      ? `She is close enough to want the real texture of him — especially around ${top.label}.`
      : band === 'forming'
        ? `Trust is forming; she is genuinely curious about ${top.label}.`
        : `She is still learning him and notices she does not yet know ${top.label}.`

  return {
    active: true,
    depth,
    target: top.label,
    reason,
    suggestedMove,
    priority,
    gaps: gaps.slice(0, 4),
  }
}

/** Compact block for system / engine prompts. */
export function formatCuriosityBlock(intent: CuriosityIntent): string {
  if (!intent.active) {
    return '(No strong curiosity move this turn. Stay with what he said.)'
  }

  const moveLine =
    intent.suggestedMove === 'question'
      ? 'If it fits naturally after answering him, one grounded question about the target is welcome — not an interview.'
      : intent.suggestedMove === 'return_to_thread'
        ? 'She may briefly return to something unfinished she still wonders about, if it fits.'
        : 'A soft observation that leaves room is enough; a question is optional.'

  return [
    `Active: yes (${intent.depth})`,
    `Target: ${intent.target}`,
    `Why: ${intent.reason}`,
    moveLine,
    'Curiosity is desire to understand him, not a checklist. Never interrogate. Never prioritize curiosity over a correction, a heavy disclosure, or a clear request.',
  ].join('\n')
}
