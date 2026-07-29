import type { ConversationDirection, ReplyObjective } from '@/lib/character-engine/types'

export type ReplyQualityResult = {
  passed: boolean
  score: number
  failures: string[]
  retryInstruction?: string
}

const EMPTY_AGREEMENT = /^(?:yeah|yep|yes|right|i know|that'?s fine|that sounds rough|that kind of day again)[.!…]*$/i
const CLARIFICATION_RESET = /\b(?:suggestions for what|what do you mean|what are you after|ideas for what)\b/i
const THERAPY_CADENCE = /\b(?:hold space|valid feelings|process your emotions|trauma response|regulate your nervous system)\b/i
const FORWARD_MOVE = /\?|\b(?:stay|tell me|want to|you could|try|start with|let me|come|sit|rest|breathe|drink|eat|quiet|company|here with you|we can)\b/i
const SPECIFIC_STRAIN = /\b(?:exhaust|deplet|fumes|drain|tired|rough|heavy|overwhelm|hurt|afraid|alone|work|day)\b/i

function objectiveSatisfied(objective: ReplyObjective, reply: string): boolean {
  const text = reply.toLowerCase()

  switch (objective) {
    case 'acknowledge':
      return text.length >= 8
    case 'comfort':
    case 'protect':
      return /\b(?:here|with you|rest|quiet|stay|do not have to|don't have to|take|easy|enough)\b/i.test(reply)
    case 'deepen_trust':
      return /\b(?:i|we|you can|with me|tell me|stay|here)\b/i.test(reply)
    case 'offer_next_step':
      return /\b(?:try|start|could|take|drink|eat|sit|rest|choose|pick|one thing|first)\b/i.test(reply)
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
      return /\b(?:but|honest|stop|choose|need to|cannot keep|can't keep)\b/i.test(reply)
    case 'reflect':
      return text.length >= 12
    case 'share_self':
      return /\b(?:i|my|me)\b/i.test(reply)
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

  if (!reply) failures.push('The reply is empty.')
  if (EMPTY_AGREEMENT.test(reply)) failures.push('The reply is only empty agreement and creates a dead end.')
  if (!opts.direction.clarificationNeeded && CLARIFICATION_RESET.test(reply)) {
    failures.push('The reply asks Mark to restate context that is already clear.')
  }
  if (THERAPY_CADENCE.test(reply)) failures.push('The reply uses clinical or therapy-style language.')

  if (opts.direction.emotionalWeight === 'high') {
    if (!SPECIFIC_STRAIN.test(reply)) failures.push('The reply does not acknowledge the established strain specifically.')
    if (!FORWARD_MOVE.test(reply)) failures.push('The reply does not add a human or conversational next move.')
  }

  for (const objective of opts.direction.objectives.slice(0, 3)) {
    if (!objectiveSatisfied(objective, reply)) {
      failures.push(`The reply does not clearly accomplish the objective: ${objective}.`)
    }
  }

  const score = Math.max(0, 100 - failures.length * 24)
  const passed = failures.length === 0

  return {
    passed,
    score,
    failures,
    retryInstruction: passed
      ? undefined
      : `Rewrite once. Keep the same character voice and length, but fix these failures: ${failures.join(' ')}`,
  }
}

export function qualityGatePrompt(direction: ConversationDirection): string {
  return `Before returning the final message, silently check it against these requirements:
- It addresses the active topic: ${direction.topic}.
- It accomplishes these objectives: ${direction.objectives.join(', ')}.
- It does not stop at empty agreement.
- It does not request clarification unless clarification is marked as required.
- It moves the conversation or relationship forward by one small step.
If the draft fails any item, rewrite it once before outputting. Output only the final companion message.`
}
