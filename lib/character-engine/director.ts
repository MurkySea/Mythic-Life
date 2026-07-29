import type {
  CharacterAnalysis,
  ConversationDirection,
  ConversationMode,
  ReplyObjective,
} from '@/lib/character-engine/types'

type DirectorTurn = {
  role: 'user' | 'companion'
  content: string
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

function parseHistory(history: string): DirectorTurn[] {
  return String(history || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':')
      if (separator < 0) return null
      const speaker = line.slice(0, separator).trim().toLowerCase()
      const content = clean(line.slice(separator + 1))
      if (!content) return null
      return {
        role: speaker === 'mark' ? 'user' : 'companion',
        content,
      } satisfies DirectorTurn
    })
    .filter((turn): turn is DirectorTurn => Boolean(turn))
    .slice(-12)
}

function isBriefContinuation(text: string): boolean {
  const value = clean(text).toLowerCase()
  if (!value) return false
  if (value.length <= 18) return true
  return /^(?:yeah|yep|yes|no|it is|i know|maybe|probably|pretty much|exactly|right|sure|any suggestions\??|what i might need\??)[.!?]*$/i.test(
    value
  )
}

function detectTopic(text: string): string {
  const value = text.toLowerCase()
  if (/\b(?:exhausted|running on fumes|depleted|burned out|burnt out|drained|worn out|tired)\b/.test(value)) {
    return 'exhaustion and depleted capacity'
  }
  if (/\b(?:work|office|client|appointment|meeting|business)\b/.test(value)) return 'work pressure'
  if (/\b(?:alone|lonely|miss|company|stay with me)\b/.test(value)) return 'connection and company'
  if (/\b(?:hurt|upset|angry|argument|fight)\b/.test(value)) return 'hurt or conflict'
  if (/\b(?:afraid|scared|anxious|worried|overwhelmed)\b/.test(value)) return 'fear or overwhelm'
  if (/\b(?:plan|next step|what should|suggestion|idea)\b/.test(value)) return 'what to do next'
  return clean(text).slice(0, 120) || 'the current conversation'
}

function modeFor(analysis: CharacterAnalysis, contextText: string): ConversationMode {
  if (analysis.isCorrection) return 'repair'
  if (analysis.isExplicitAdviceRequest) return 'problem_solving'
  if (analysis.need === 'be_heard' || analysis.isVulnerable) return 'comfort'
  if (analysis.need === 'company') return 'company'
  if (analysis.need === 'play') return 'play'
  if (analysis.need === 'celebration') return 'celebration'
  if (/\b(?:suggestion|ideas|what should|what might i need|what do i need)\b/i.test(contextText)) {
    return 'guided_clarity'
  }
  return 'conversation'
}

function objectivesFor(opts: {
  analysis: CharacterAnalysis
  mode: ConversationMode
  emotionallyLoaded: boolean
  continuation: boolean
}): ReplyObjective[] {
  const { analysis, mode, emotionallyLoaded, continuation } = opts

  if (analysis.isCorrection) return ['acknowledge', 'clarify', 'deepen_trust']
  if (analysis.isExplicitFlirtation) return ['acknowledge', 'flirt']
  if (mode === 'celebration') return ['celebrate', 'deepen_trust']
  if (mode === 'play') return ['play', 'share_self']
  if (mode === 'problem_solving' || mode === 'guided_clarity') {
    return emotionallyLoaded
      ? ['acknowledge', 'comfort', 'offer_next_step']
      : ['acknowledge', 'offer_next_step']
  }
  if (emotionallyLoaded) {
    return continuation
      ? ['acknowledge', 'comfort', 'deepen_trust']
      : ['acknowledge', 'comfort']
  }
  if (mode === 'company') return ['acknowledge', 'deepen_trust', 'share_self']
  return ['acknowledge', 'reflect']
}

function trajectoryFor(opts: {
  continuation: boolean
  emotionallyLoaded: boolean
  analysis: CharacterAnalysis
  recentUserTurns: number
}): 'opening' | 'steady' | 'deepening' | 'resolving' | 'shifting' {
  if (opts.analysis.isCorrection) return 'shifting'
  if (!opts.continuation) return 'opening'
  if (opts.emotionallyLoaded && opts.recentUserTurns >= 2) return 'deepening'
  return 'steady'
}

export function directConversation(opts: {
  userText: string
  recentHistory?: string
  analysis: CharacterAnalysis
}): ConversationDirection {
  const turns = parseHistory(opts.recentHistory || '')
  const latest = clean(opts.userText)
  const previousUserTurns = turns.filter((turn) => turn.role === 'user')
  const latestPreviousUser = previousUserTurns.at(-1)?.content || ''
  const earlierPreviousUser = previousUserTurns.at(-2)?.content || ''
  const continuation = isBriefContinuation(latest)

  const carriedContext = continuation
    ? [earlierPreviousUser, latestPreviousUser, latest].filter(Boolean).join(' ')
    : [latestPreviousUser, latest].filter(Boolean).join(' ')

  const contextText = carriedContext || latest
  const topicSource = continuation && latestPreviousUser ? `${earlierPreviousUser} ${latestPreviousUser}` : latest
  const topic = detectTopic(topicSource)
  const mode = modeFor(opts.analysis, contextText)

  const emotionallyLoaded =
    opts.analysis.isVulnerable ||
    /\b(?:exhausted|running on fumes|depleted|burned out|drained|hurt|alone|scared|afraid|overwhelmed|lost)\b/i.test(
      contextText
    )

  const clarificationNeeded =
    opts.analysis.isCorrection ||
    (!continuation && opts.analysis.asksQuestion && opts.analysis.confidence < 0.6)

  const objectives = objectivesFor({
    analysis: opts.analysis,
    mode,
    emotionallyLoaded,
    continuation,
  })

  const goal = emotionallyLoaded
    ? mode === 'problem_solving' || mode === 'guided_clarity'
      ? 'Understand the strain already established, then offer one small practical or comforting option.'
      : 'Help Mark feel accompanied and understood, then move the relationship forward by one small step.'
    : mode === 'problem_solving'
      ? 'Answer the request directly with one useful next move.'
      : 'Keep the conversation moving naturally from the established topic.'

  const avoid = [
    continuation ? 'asking what he means when the recent thread already makes it clear' : '',
    emotionallyLoaded ? 'a dead-end acknowledgment with no relational or conversational movement' : '',
    emotionallyLoaded ? 'empty agreement such as “yeah,” “that is fine,” or “that sounds rough” with no further move' : '',
    emotionallyLoaded ? 'therapy language, diagnosis, or a motivational speech' : '',
    mode !== 'problem_solving' && mode !== 'guided_clarity' ? 'unsolicited problem-solving' : '',
  ].filter(Boolean)

  const activeTurns = Math.max(1, Math.min(6, previousUserTurns.length + 1))

  return {
    version: 2,
    mode,
    topic,
    continuity: continuation ? 'continuation' : 'new_turn',
    emotionalWeight: emotionallyLoaded ? 'high' : 'normal',
    likelyNeed: opts.analysis.need,
    goal,
    objectives,
    momentum: {
      activeTopic: topic,
      activeTurns,
      trajectory: trajectoryFor({
        continuation,
        emotionallyLoaded,
        analysis: opts.analysis,
        recentUserTurns: previousUserTurns.length,
      }),
      continueUntil: emotionallyLoaded
        ? ['Mark changes the subject', 'the need is meaningfully answered', 'the companion intentionally transitions']
        : ['Mark changes the subject', 'the current question or exchange is complete'],
    },
    clarificationNeeded,
    responseRequirements: emotionallyLoaded
      ? [
          'Acknowledge the established strain specifically.',
          'Complete the primary reply objectives instead of stopping after acknowledgment.',
          'Add one human move: presence, a small choice, one concrete suggestion, or one sincere question.',
          'Stay concise and in character.',
        ]
      : [
          'Respond to the actual topic.',
          'Complete the primary reply objective.',
          'Move the exchange forward rather than merely echoing Mark.',
        ],
    avoid,
  }
}
