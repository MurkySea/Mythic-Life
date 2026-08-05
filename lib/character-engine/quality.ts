import type {
  ConversationDirection,
  DisclosureAssessment,
  ReplyObjective,
} from '@/lib/character-engine/types'

export type ReplyQualityResult = {
  passed: boolean
  score: number
  failures: string[]
  violations?: CompanionQualityViolation[]
  retryInstruction?: string
}

export type CompanionQualityViolation =
  | 'unearned_callback' | 'new_day_continuation' | 'vague_language'
  | 'poetic_overreach' | 'motif_repetition' | 'self_centered_opening'
  | 'generic_question' | 'therapy_default' | 'identity_mismatch'
  | 'director_mismatch' | 'memory_leak' | 'excessive_length'
  | 'empty_acknowledgement' | 'missing_relational_move'

const EMPTY_AGREEMENT =
  /^(?:yeah|yep|yes|right|i know|that'?s fine|that sounds rough|that kind of day again|that tracks|i hear you|got it|okay|ok)[.!…]*$/i
const CLARIFICATION_RESET =
  /\b(?:suggestions for what|what do you mean|what are you after|ideas for what)\b/i
const THERAPY_CADENCE =
  /\b(?:hold space|valid feelings|process your emotions|trauma response|regulate your nervous system|your feelings are valid|i'?m here to support you|safe space)\b/i
const VAGUE_ATMOSPHERE = /\b(?:the (?:morning|day|air|room|silence|light) (?:feels?|seems?|is) (?:quieter|softer|different|heavy)|old shape|light (?:is )?(?:starting to )?feel|stillness (?:today|this morning)|quiet (?:has|is|feels))\b/i
const PRIOR_DAY_CALLBACK = /\b(?:yesterday|last night|still (?:carrying|thinking about)|old shape|what we talked about)\b/i
const GENERIC_QUESTION = /^(?:.{0,45}[.!]\s*)?(?:how are you feeling|what'?s on your mind|want to talk about it|how can i support you)\??$/i
const SELF_CENTERED_GREETING = /^(?:i|my)\b/i
const GREETING_ACK = /\b(?:morning|afternoon|evening|hello|hey|hi|good to see you|glad you'?re here)\b/i
const POETIC_NARRATION = /\b(?:night loosened its grip|circling the answer|bird afraid to land|embers? (?:of|in)|shadows? (?:of|across)|flame (?:within|between))\b/i
const PRESENCE_MOVE =
  /\b(?:here|with you|with me|stay|quiet|take your time|no rush|not going anywhere|do not have to|don'?t have to|sit with|we can leave it here)\b/i
const FORWARD_MOVE =
  /\?|\b(?:stay|tell me|want to|you could|try|start with|let me|come|sit|rest|breathe|drink|eat|quiet|company|here with you|with me|we can|take your time|no rush|do not have to|don'?t have to)\b/i
const SPECIFIC_STRAIN =
  /\b(?:exhaust\w*|deplet\w*|fumes|drain\w*|tired|wired[ -]?tired|restless|finished|rough|heavy|overwhelm\w*|hurt|afraid|alone|work|day)\b/i
const REFLECTIVE_ANCHOR =
  /\b(?:without|never|always|growing up|raised|affection|chosen|tolerated|earned|had to|couldn'?t|shouldn'?t|that kind of|what that does|what that taught|that teaches|love deficient|deficient)\b/i

const DISCLOSURE_EVIDENCE: Partial<
  Record<DisclosureAssessment['categories'][number], RegExp>
> = {
  preference: /\b(?:prefer|favorite|like|love|hate)\b/i,
  identity: /\b(?:identity|who you are|part of you|see yourself)\b/i,
  relationship: /\b(?:love|loved|chosen|tolerated|affection|belong|valued|relationship)\b/i,
  fear: /\b(?:fear|afraid|scared|worry)\b/i,
  childhood: /\b(?:childhood|raised|growing up|home|household|family|parent|mother|father)\b/i,
  trauma: /\b(?:abuse|abused|assault|violence|what happened|survive|should not have happened)\b/i,
  grief: /\b(?:grief|lost|death|died|passed|miss)\b/i,
  shame: /\b(?:shame|ashamed|fault|worthy|deserve)\b/i,
  hope: /\b(?:hope|dream|future|want)\b/i,
}

function questionCount(reply: string): number {
  return reply.match(/\?/g)?.length ?? 0
}

/**
 * For depth >= 4 a reply must show that the specific meaning landed.
 * Category keyword match is the primary signal; reflective anchors + length
 * provide a secondary path so genuine reflection is not rejected solely because
 * it avoids the exact category lexicon.
 */
function acknowledgesDisclosure(direction: ConversationDirection, reply: string): boolean {
  if (direction.disclosure.depth < 4) return true

  const trimmed = reply.trim()
  if (trimmed.length < 28) return false

  const patterns = direction.disclosure.categories
    .map((category) => DISCLOSURE_EVIDENCE[category])
    .filter((pattern): pattern is RegExp => Boolean(pattern))

  const categoryHit = patterns.length === 0 ? true : patterns.some((pattern) => pattern.test(reply))
  const reflectiveHit = REFLECTIVE_ANCHOR.test(reply)

  // Require either a category signal or clear reflective language.
  // Pure length is not enough; empty agreement is already rejected elsewhere.
  return categoryHit || reflectiveHit
}

function objectiveSatisfied(
  objective: ReplyObjective,
  reply: string,
  direction: ConversationDirection
): boolean {
  const text = reply.toLowerCase()

  switch (objective) {
    case 'acknowledge':
      return text.length >= 8
    case 'comfort':
    case 'protect':
      return /\b(?:here|with you|rest|quiet|stay|do not have to|don'?t have to|take|easy|enough)\b/i.test(
        reply
      )
    case 'deepen_trust':
      return /\b(?:i|we|you can|with me|tell me|stay|here)\b/i.test(reply)
    case 'offer_next_step':
      return /\b(?:try|start|could|take|drink|eat|sit|rest|choose|pick|one thing|first)\b/i.test(
        reply
      )
    case 'clarify':
      return /\?|\b(?:mean|which|whether)\b/i.test(reply)
    case 'celebrate':
      return /\b(?:good|proud|did it|won|earned|finally|hell yes|look at you)\b/i.test(reply)
    case 'play':
      return /\b(?:ha|tease|trouble|clever|bold|dramatic)\b/i.test(reply)
    case 'flirt':
      return /\b(?:want|closer|beautiful|handsome|tempt|miss|mine)\b/i.test(reply)
    case 'encourage':
    case 'inspire':
      return /\b(?:can|keep|one step|not done|still|capable|believe)\b/i.test(reply)
    case 'challenge':
      return /\b(?:but|honest|stop|choose|need to|cannot keep|can'?t keep)\b/i.test(reply)
    case 'reflect':
      return text.length >= 12
    case 'share_self':
      return /\b(?:i|my|me)\b/i.test(reply)
    case 'honor_contract':
      return direction.contract?.type === 'turn_taking_questions' &&
        direction.contract.nextActor === 'companion'
        ? questionCount(reply) === 1
        : true
    case 'explore_disclosure':
      return acknowledgesDisclosure(direction, reply) && reply.trim().length >= 20
    case 'stay_present':
      return PRESENCE_MOVE.test(reply)
    default:
      return true
  }
}

export function evaluateCompanionReply(opts: {
  reply: string
  direction: ConversationDirection
}): ReplyQualityResult {
  const reply = String(opts.reply || '').trim()
  const failures: string[] = []
  const violations: CompanionQualityViolation[] = []
  const fail = (violation: CompanionQualityViolation, message: string) => {
    violations.push(violation)
    failures.push(message)
  }

  if (!reply) failures.push('The reply is empty.')
  if (EMPTY_AGREEMENT.test(reply))
    fail('empty_acknowledgement', 'The reply is only empty agreement and creates a dead end.')
  if (!opts.direction.clarificationNeeded && CLARIFICATION_RESET.test(reply)) {
    failures.push('The reply asks Mark to restate context that is already clear.')
  }
  if (THERAPY_CADENCE.test(reply))
    fail('therapy_default', 'The reply uses clinical or therapy-style language.')
  if (VAGUE_ATMOSPHERE.test(reply))
    fail('vague_language', 'The reply substitutes vague atmospheric language for concrete meaning.')
  if (POETIC_NARRATION.test(reply) && opts.direction.metaphorBudget === 0)
    fail('poetic_overreach', 'The reply exceeds the directorâ€™s metaphor budget.')
  if (opts.direction.newDayDetected && !opts.direction.callbackAllowed && PRIOR_DAY_CALLBACK.test(reply))
    fail('new_day_continuation', 'The reply resumes a previous-day topic without authorization.')
  if (!opts.direction.callbackAllowed && /\b(?:you told me|i remember when|as you said before)\b/i.test(reply))
    fail('unearned_callback', 'The reply mentions memory without director authorization.')
  if (opts.direction.newDayDetected && opts.direction.primaryMove === 'acknowledge' && SELF_CENTERED_GREETING.test(reply) && !GREETING_ACK.test(reply))
    fail('self_centered_opening', 'The reply opens on the companion and ignores the new-day greeting.')
  if (opts.direction.newDayDetected && !GREETING_ACK.test(reply))
    fail('director_mismatch', 'The reply does not acknowledge the greeting on a new day.')
  if (GENERIC_QUESTION.test(reply))
    fail('generic_question', 'The reply relies on a generic engagement question.')
  const repeatedMotif = opts.direction.prohibitedPatterns.some((pattern) => {
    if (pattern === 'quiet') return /\b(?:quiet|silence|stillness|softly?)\b/i.test(reply)
    if (pattern === 'light') return /\b(?:light|shadow|warmth|ember|flame)\b/i.test(reply)
    if (pattern === 'carrying') return /\b(?:old shape|belong|breathe|carrying|linger)\b/i.test(reply)
    if (pattern === 'atmosphere') return /\b(?:window|forest|rain|home)\b/i.test(reply)
    return false
  })
  if (repeatedMotif) fail('motif_repetition', 'The reply repeats a motif currently under cooldown.')
  const maxWords = opts.direction.desiredLength === 'very_short' ? 45 : opts.direction.desiredLength === 'short' ? 85 : opts.direction.desiredLength === 'medium' ? 160 : 260
  if (reply.split(/\s+/).length > maxWords)
    fail('excessive_length', 'The reply is longer than the director requested.')

  if (opts.direction.emotionalWeight === 'high') {
    if (opts.direction.disclosure.depth >= 4) {
      if (!acknowledgesDisclosure(opts.direction, reply)) {
        failures.push(
          'The reply does not reflect the specific meaning of the significant disclosure.'
        )
      }
    } else if (!SPECIFIC_STRAIN.test(reply)) {
      failures.push('The reply does not acknowledge the established strain specifically.')
    }

    if (!FORWARD_MOVE.test(reply))
      failures.push('The reply does not add a human or conversational next move.')
  }

  if (
    opts.direction.obligations.includes('fulfill_conversation_contract') &&
    opts.direction.contract?.type === 'turn_taking_questions' &&
    opts.direction.contract.nextActor === 'companion' &&
    questionCount(reply) !== 1
  ) {
    failures.push(
      'The reply does not fulfill the active turn-taking question contract with exactly one question.'
    )
  }

  if (
    opts.direction.obligations.includes('reflect_specific_meaning') &&
    !acknowledgesDisclosure(opts.direction, reply)
  ) {
    failures.push("The reply does not show that the disclosure's specific meaning landed.")
  }

  if (
    opts.direction.obligations.includes('ask_one_grounded_question') &&
    questionCount(reply) !== 1
  ) {
    failures.push(
      'The reply does not ask the one grounded question required by the disclosure.'
    )
  }

  if (
    opts.direction.obligations.includes('offer_quiet_presence') &&
    !PRESENCE_MOVE.test(reply)
  ) {
    failures.push(
      'The reply does not offer grounded quiet presence after the depth-five disclosure.'
    )
  }

  for (const objective of opts.direction.objectives.slice(0, 3)) {
    if (!objectiveSatisfied(objective, reply, opts.direction)) {
      failures.push(`The reply does not clearly accomplish the objective: ${objective}.`)
    }
  }

  const uniqueFailures = [...new Set(failures)]
  const score = Math.max(0, 100 - uniqueFailures.length * 24)
  const passed = uniqueFailures.length === 0

  return {
    passed,
    score,
    failures: uniqueFailures,
    violations: [...new Set(violations)],
    retryInstruction: passed
      ? undefined
      : `Rewrite once. Keep the same character voice and length, but fix these failures: ${uniqueFailures.join(' ')}`,
  }
}

export function qualityGatePrompt(direction: ConversationDirection): string {
  const contractRule =
    direction.contract?.active && direction.contract.nextActor === 'companion'
      ? `- ACTIVE CONVERSATION CONTRACT: ${direction.contract.type}. It is the companion's turn. Fulfill it in this reply (exactly one question for turn-taking). Do not abandon or renegotiate the agreement silently.`
      : direction.contract?.active
        ? `- Active conversation contract (${direction.contract.type}) is waiting on Mark; do not seize the turn.`
        : '- There is no active conversation contract to fulfill.'

  return `Before returning the final message, silently check it against these requirements:
- It addresses the active topic: ${direction.topic}.
- It follows the director move (${direction.primaryMove}), topic source (${direction.topicSource}), and ${direction.desiredLength} length.
- Callback authorization: ${direction.callbackAllowed ? `allowed â€” ${direction.callbackReason || 'current relevance'}` : 'not allowed; do not mention prior conversations or memories'}.
- New day: ${direction.newDayDetected ? 'yes; acknowledge the present greeting before anything else' : 'no'}.
- Metaphor budget: ${direction.metaphorBudget}. Speak concretely by default.
- Avoid current cooldowns and fatigue patterns: ${direction.prohibitedPatterns.join(', ') || 'none'}.
- It accomplishes these objectives: ${direction.objectives.join(', ')}.
- Disclosure depth is ${direction.disclosure.depth}/5; categories: ${direction.disclosure.categories.join(', ') || 'none'}.
- It fulfills these response obligations: ${direction.obligations.join(', ') || 'none'}.
${contractRule}
- A depth-4 or depth-5 disclosure is reflected specifically before advice, flirtation, or a topic change.
- It does not stop at empty agreement.
- It does not request clarification unless clarification is marked as required.
- It moves the conversation or relationship forward by one small step.
If the draft fails any item, rewrite it once before outputting. Output only the final companion message.`
}
