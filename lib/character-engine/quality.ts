import type {
  ConversationDirection,
  DisclosureAssessment,
  ReplyObjective,
} from '@/lib/character-engine/types'

export type ReplyQualityResult = {
  passed: boolean
  score: number
  failures: string[]
  retryInstruction?: string
}

const EMPTY_ACKNOWLEDGEMENT =
  /^(?:yeah(?:,\s*that tracks)?|yep|yes|right|i know|i hear you|i understand|i get it|that'?s fine|that sounds rough|that kind of day again|that tracks|that makes sense|makes sense)[.!…]*$/i
const CLARIFICATION_RESET =
  /\b(?:suggestions for what|what do you mean|what are you after|ideas for what)\b/i
const THERAPY_CADENCE =
  /\b(?:hold space|valid feelings|process your emotions|trauma response|regulate your nervous system)\b/i
const CONCRETE_PRESENCE =
  /\b(?:i(?:'m| am) here(?: with you)?|i(?:'ll| will| am|'m) stay(?:ing)?|let me (?:stay|sit|help|carry|keep)|stay with me|come sit with me|we can (?:sit|stay|take|leave|choose|figure)|you (?:do not|don't) have to [^.!?]{0,60}(?:with me|alone)|beside you|next to you|my company|not going anywhere)\b/i
const FORWARD_MOVE =
  /\?|\b(?:stay|tell me|want to|you could|try|start with|let me|come|sit|rest|breathe|drink|eat|quiet|company|here with you|with me|we can|take your time|no rush|do not have to|don't have to)\b/i
const SPECIFIC_STRAIN =
  /\b(?:exhaust|deplet|fumes|drain|tired|rough|heavy|overwhelm|hurt|afraid|alone|work|day)\b/i
const MEANINGFUL_CHOICE =
  /\b(?:would you rather|do you want (?:me to|to)?|we (?:can|could) .{1,60}\bor\b|either .{1,60}\bor\b|choose between|pick one|your choice)\b/i
const SPECIFIC_INSIGHT =
  /\b(?:can teach|has taught|might mean|may mean|sounds like .{1,80}\b(?:because|not just)|not just .{1,80}\bbut\b|the fact that .{1,80}\b(?:means|shows)|i think .{1,80}\bbecause\b|i wonder if .{1,80}\bbecause\b)\b/i
const PRIOR_EXCHANGE_CONTINUITY =
  /\b(?:you (?:said|mentioned|told me)|earlier|last time|when we (?:talked|spoke)|we(?:'ve| have) (?:talked|been through)|this again|the same .{1,40} again)\b/i
const DECORATIVE_ENVIRONMENT =
  /\b(?:fire|flames?|embers?|hearth|chamber|moonlight|moon|silence|warmth|warm light|candlelight|shadows?|stars?|rain-dark|mist)\b/i

const DISCLOSURE_EVIDENCE: Partial<
  Record<DisclosureAssessment['categories'][number], RegExp>
> = {
  preference: /\b(?:prefer|favorite|like|love|hate)\b/i,
  identity: /\b(?:identity|who you are|part of you|see yourself)\b/i,
  relationship:
    /\b(?:love|loved|chosen|tolerated|affection|belong|valued|relationship)\b/i,
  fear: /\b(?:fear|afraid|scared|worry)\b/i,
  childhood:
    /\b(?:childhood|raised|growing up|home|household|family|parent|mother|father)\b/i,
  trauma:
    /\b(?:abuse|abused|assault|violence|what happened|survive|should not have happened)\b/i,
  grief: /\b(?:grief|lost|death|died|passed|miss)\b/i,
  shame: /\b(?:shame|ashamed|fault|worthy|deserve)\b/i,
  hope: /\b(?:hope|dream|future|want)\b/i,
}

function questionCount(reply: string): number {
  return reply.match(/\?/g)?.length ?? 0
}

function hasGroundedCuriosity(reply: string): boolean {
  if (questionCount(reply) === 0 || CLARIFICATION_RESET.test(reply)) return false

  const questions = reply
    .split(/(?<=[?])/)
    .filter((sentence) => sentence.includes('?'))

  return questions.some((question) => {
    const words = question.match(/\b[\p{L}\p{N}'’-]+\b/gu) ?? []
    return (
      words.length >= 6 &&
      /\b(?:what|which|when|where|who|why|how|is|are|do|does|did|would|could|can|has|have)\b/i.test(
        question
      ) &&
      /\b(?:you|your|it|that|this|something|part|feel|keeping|want|need|matter|happened)\b/i.test(
        question
      )
    )
  })
}

function hasMeaningfulRelationalMove(reply: string): boolean {
  return (
    hasGroundedCuriosity(reply) ||
    SPECIFIC_INSIGHT.test(reply) ||
    MEANINGFUL_CHOICE.test(reply) ||
    CONCRETE_PRESENCE.test(reply) ||
    PRIOR_EXCHANGE_CONTINUITY.test(reply)
  )
}

function acknowledgesDisclosure(
  direction: ConversationDirection,
  reply: string
): boolean {
  if (direction.disclosure.depth < 4) return true

  const patterns = direction.disclosure.categories
    .map((category) => DISCLOSURE_EVIDENCE[category])
    .filter((pattern): pattern is RegExp => Boolean(pattern))

  if (patterns.length === 0) return reply.trim().length >= 24
  return patterns.some((pattern) => pattern.test(reply))
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
      return (
        /\b(?:here|with you|rest|quiet|stay|do not have to|don't have to|take|easy|enough)\b/i.test(
          reply
        ) || hasMeaningfulRelationalMove(reply)
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
      return /\b(?:good|proud|did it|won|earned|finally|hell yes|look at you)\b/i.test(
        reply
      )
    case 'play':
      return /\b(?:ha|tease|trouble|clever|bold|dramatic)\b/i.test(reply)
    case 'flirt':
      return /\b(?:want|closer|beautiful|handsome|tempt|miss|mine)\b/i.test(reply)
    case 'encourage':
    case 'inspire':
      return /\b(?:can|keep|one step|not done|still|capable|believe)\b/i.test(reply)
    case 'challenge':
      return /\b(?:but|honest|stop|choose|need to|cannot keep|can't keep)\b/i.test(
        reply
      )
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
      return CONCRETE_PRESENCE.test(reply)
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
  const meaningfulRelationalMove = hasMeaningfulRelationalMove(reply)
  const requiresMeaningfulRelationalMove =
    opts.direction.emotionalWeight !== 'normal' ||
    opts.direction.disclosure.depth >= 2

  if (!reply) failures.push('The reply is empty.')
  if (EMPTY_ACKNOWLEDGEMENT.test(reply)) {
    failures.push(
      'The reply is only empty acknowledgment and creates a dead end.'
    )
  }
  if (
    !opts.direction.clarificationNeeded &&
    CLARIFICATION_RESET.test(reply)
  ) {
    failures.push(
      'The reply asks Mark to restate context that is already clear.'
    )
  }
  if (THERAPY_CADENCE.test(reply)) {
    failures.push('The reply uses clinical or therapy-style language.')
  }
  if (requiresMeaningfulRelationalMove && !meaningfulRelationalMove) {
    failures.push(
      'The reply only paraphrases or validates; it needs a meaningful relational move such as specific insight, grounded curiosity, meaningful choice, concrete presence, or continuity.'
    )
  }
  if (DECORATIVE_ENVIRONMENT.test(reply) && !meaningfulRelationalMove) {
    failures.push(
      'Decorative setting imagery substitutes for engagement instead of adding a meaningful relational move.'
    )
  }

  if (opts.direction.emotionalWeight === 'high') {
    if (opts.direction.disclosure.depth >= 4) {
      if (!acknowledgesDisclosure(opts.direction, reply)) {
        failures.push(
          'The reply does not reflect the specific meaning of the significant disclosure.'
        )
      }
    } else if (!SPECIFIC_STRAIN.test(reply)) {
      failures.push(
        'The reply does not acknowledge the established strain specifically.'
      )
    }

    if (!FORWARD_MOVE.test(reply)) {
      failures.push(
        'The reply does not add a human or conversational next move.'
      )
    }
  }

  if (
    opts.direction.obligations.includes(
      'fulfill_conversation_contract'
    ) &&
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
    failures.push(
      'The reply does not show that the disclosure’s specific meaning landed.'
    )
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
    !CONCRETE_PRESENCE.test(reply)
  ) {
    failures.push(
      'The reply does not offer grounded quiet presence after the depth-five disclosure.'
    )
  }

  for (const objective of opts.direction.objectives.slice(0, 3)) {
    if (!objectiveSatisfied(objective, reply, opts.direction)) {
      failures.push(
        `The reply does not clearly accomplish the objective: ${objective}.`
      )
    }
  }

  const uniqueFailures = [...new Set(failures)]
  const score = Math.max(0, 100 - uniqueFailures.length * 24)
  const passed = uniqueFailures.length === 0

  return {
    passed,
    score,
    failures: uniqueFailures,
    retryInstruction: passed
      ? undefined
      : `Rewrite once. Keep the same character voice and length, but fix these failures: ${uniqueFailures.join(' ')}`,
  }
}

export function qualityGatePrompt(direction: ConversationDirection): string {
  const contractRule =
    direction.contract?.active &&
    direction.contract.nextActor === 'companion'
      ? `- Honor the active ${direction.contract.type} agreement in this reply.`
      : '- There is no active conversation contract to fulfill.'

  return `Before returning the final message, silently check it against these requirements:
- It addresses the active topic: ${direction.topic}.
- It accomplishes these objectives: ${direction.objectives.join(', ')}.
- Disclosure depth is ${direction.disclosure.depth}/5; categories: ${direction.disclosure.categories.join(', ') || 'none'}.
- It fulfills these response obligations: ${direction.obligations.join(', ') || 'none'}.
${contractRule}
- A depth-4 or depth-5 disclosure is reflected specifically before advice, flirtation, or a topic change.
- It does not stop at empty agreement.
- A vulnerable or disclosure turn includes specific insight, grounded curiosity, a meaningful choice, concrete presence, or continuity from the prior exchange.
- Decorative setting imagery never substitutes for engagement.
- It does not request clarification unless clarification is marked as required.
- It moves the conversation or relationship forward by one small step.
If the draft fails any item, rewrite it once before outputting. Output only the final companion message.`
}
