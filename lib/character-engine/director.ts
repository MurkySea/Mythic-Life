import type {
  CharacterAnalysis,
  ConversationContract,
  ConversationDirection,
  ConversationMode,
  DisclosureAssessment,
  ReplyObjective,
  ResponseObligation,
  CharacterState,
  CompanionMemory,
} from '@/lib/character-engine/types'
import { explicitlyRequestsCallback, isGenericGreeting, selectInnerLifeInitiative } from '@/lib/character-engine/living'

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
    .slice(-16)
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
  if (/\b(?:love deficient|without affection|not loved|unloved|never chosen|only tolerated)\b/.test(value)) {
    return 'formative experiences of love and belonging'
  }
  if (/\b(?:childhood|raised|growing up|parents?|mother|father|family)\b/.test(value)) {
    return 'childhood and formative family experience'
  }
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

function assessDisclosure(text: string): DisclosureAssessment {
  const value = clean(text).toLowerCase()
  const categories: DisclosureAssessment['categories'] = []
  const rationale: string[] = []

  if (/\b(?:favorite|prefer|i like|i love|i hate)\b/.test(value)) categories.push('preference')
  if (/\b(?:i am|i'm|who i am|part of me|my identity)\b/.test(value)) categories.push('identity')
  if (/\b(?:relationship|marriage|wife|husband|friend|chosen|tolerated|loved)\b/.test(value)) categories.push('relationship')
  if (/\b(?:afraid|scared|fear|terrified|worried)\b/.test(value)) categories.push('fear')
  if (/\b(?:childhood|raised|growing up|as a kid|parents?|mother|father|household)\b/.test(value)) categories.push('childhood')
  if (/\b(?:abuse|abused|trauma|assault|molest|violence)\b/.test(value)) categories.push('trauma')
  if (/\b(?:grief|died|death|lost him|lost her|passed away)\b/.test(value)) categories.push('grief')
  if (/\b(?:ashamed|shame|disgusted with myself|hate myself)\b/.test(value)) categories.push('shame')
  if (/\b(?:hope|dream|want my life|someday|purpose)\b/.test(value)) categories.push('hope')

  let depth: DisclosureAssessment['depth'] = 1
  if (categories.length > 0 || value.length >= 70) depth = 2
  if (categories.some((category) => ['identity', 'relationship', 'fear', 'hope'].includes(category))) depth = 3
  if (categories.some((category) => ['childhood', 'grief', 'shame'].includes(category))) depth = 4
  if (categories.includes('trauma') || /\b(?:love deficient household|never felt loved|only valued when useful|never chosen|only tolerated)\b/.test(value)) depth = 5

  if (depth >= 4) rationale.push('formative or identity-shaping disclosure')
  if (categories.includes('trauma') || categories.includes('grief')) rationale.push('high vulnerability content')
  if (/\b(?:never|always|my whole life|raised|growing up)\b/.test(value)) rationale.push('long-duration personal pattern')

  return {
    depth,
    categories: [...new Set(categories)],
    requiresPause: depth >= 4,
    rationale,
  }
}

function detectContract(turns: DirectorTurn[], latest: string): ConversationContract | null {
  const allTurns = [...turns, { role: 'user' as const, content: latest }]
  const startIndex = allTurns.findLastIndex((turn) =>
    /\b(?:let'?s|we should|can we)\s+(?:take turns|alternate)\s+(?:asking )?(?:each other )?questions\b/i.test(turn.content)
  )
  if (startIndex < 0) return null

  const afterStart = allTurns.slice(startIndex + 1)
  if (afterStart.some((turn) => /\b(?:stop|end|done with|no more)\s+(?:the )?(?:questions|game)\b/i.test(turn.content))) {
    return null
  }

  const lastTurn = allTurns.at(-1)
  return {
    type: 'turn_taking_questions',
    active: true,
    nextActor: lastTurn?.role === 'user' ? 'companion' : 'user',
    source: allTurns[startIndex].content,
  }
}

function objectivesFor(opts: {
  analysis: CharacterAnalysis
  mode: ConversationMode
  emotionallyLoaded: boolean
  continuation: boolean
  disclosure: DisclosureAssessment
  contract: ConversationContract | null
}): ReplyObjective[] {
  const { analysis, mode, emotionallyLoaded, continuation, disclosure, contract } = opts

  if (contract?.active && contract.nextActor === 'companion') {
    return disclosure.depth >= 4
      ? ['acknowledge', 'explore_disclosure', 'honor_contract']
      : ['acknowledge', 'honor_contract']
  }
  if (analysis.isCorrection) return ['acknowledge', 'clarify', 'deepen_trust']
  if (analysis.isExplicitFlirtation) return ['acknowledge', 'flirt']
  if (mode === 'celebration') return ['celebrate', 'deepen_trust']
  if (mode === 'play') return ['play', 'share_self']
  if (disclosure.depth >= 4) return ['acknowledge', 'explore_disclosure', 'stay_present']
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

function obligationsFor(
  disclosure: DisclosureAssessment,
  contract: ConversationContract | null
): ResponseObligation[] {
  const obligations: ResponseObligation[] = []
  if (disclosure.depth >= 4) {
    obligations.push('reflect_specific_meaning', 'validate_without_diagnosing')
    obligations.push(disclosure.depth === 5 ? 'offer_quiet_presence' : 'ask_one_grounded_question')
  }
  if (contract?.active && contract.nextActor === 'companion') {
    obligations.push('fulfill_conversation_contract')
  }
  return obligations
}

function trajectoryFor(opts: {
  continuation: boolean
  emotionallyLoaded: boolean
  analysis: CharacterAnalysis
  recentUserTurns: number
  disclosure: DisclosureAssessment
}): 'opening' | 'steady' | 'deepening' | 'resolving' | 'shifting' {
  if (opts.analysis.isCorrection) return 'shifting'
  if (opts.disclosure.depth >= 4) return 'deepening'
  if (!opts.continuation) return 'opening'
  if (opts.emotionallyLoaded && opts.recentUserTurns >= 2) return 'deepening'
  return 'steady'
}

export function directConversation(opts: {
  userText: string
  recentHistory?: string
  analysis: CharacterAnalysis
  state?: CharacterState
  newDayDetected?: boolean
  relevantMemories?: CompanionMemory[]
}): ConversationDirection {
  const turns = parseHistory(opts.recentHistory || '')
  const latest = clean(opts.userText)
  const previousUserTurns = turns.filter((turn) => turn.role === 'user')
  const latestPreviousUser = previousUserTurns.at(-1)?.content || ''
  const earlierPreviousUser = previousUserTurns.at(-2)?.content || ''
  const explicitCallback = explicitlyRequestsCallback(latest)
  const openLoop = opts.relevantMemories?.find((memory) => memory.type === 'open_loop' && memory.unresolved)
  const relevantMemory = opts.relevantMemories?.[0]
  const callbackAllowed = explicitCallback || Boolean(openLoop) || Boolean(relevantMemory)
  const continuation = !opts.newDayDetected && isBriefContinuation(latest)

  const carriedContext = continuation
    ? [earlierPreviousUser, latestPreviousUser, latest].filter(Boolean).join(' ')
    : [latestPreviousUser, latest].filter(Boolean).join(' ')

  const contextText = carriedContext || latest
  const topicSource = continuation && latestPreviousUser ? `${earlierPreviousUser} ${latestPreviousUser}` : latest
  const initiative = opts.state ? selectInnerLifeInitiative(opts.state, latest) : undefined
  const greeting = isGenericGreeting(latest)
  const selectedTopic = greeting && !callbackAllowed ? initiative : undefined
  const topic = selectedTopic || (openLoop ? openLoop.summary : detectTopic(topicSource))
  const mode = modeFor(opts.analysis, contextText)
  const disclosure = assessDisclosure(latest)
  const contract = detectContract(turns, latest)

  const emotionallyLoaded =
    disclosure.depth >= 4 ||
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
    disclosure,
    contract,
  })
  const obligations = obligationsFor(disclosure, contract)

  const goal = disclosure.depth >= 4
    ? 'Slow down, show that the meaning landed, and remain with the disclosure before changing topics.'
    : emotionallyLoaded
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
    disclosure.requiresPause ? 'moving past the disclosure as though it were ordinary background information' : '',
    contract?.active ? 'forgetting or violating the active turn-taking agreement' : '',
    mode !== 'problem_solving' && mode !== 'guided_clarity' ? 'unsolicited problem-solving' : '',
  ].filter(Boolean)

  const activeTurns = Math.max(1, Math.min(6, previousUserTurns.length + 1))

  const primaryMove = opts.analysis.isCorrection ? 'acknowledge'
    : opts.analysis.isExplicitAdviceRequest ? 'answer'
      : disclosure.depth >= 4 ? 'support'
        : greeting && selectedTopic ? 'share'
          : greeting ? 'acknowledge'
            : opts.analysis.asksQuestion ? 'answer'
              : mode === 'play' ? 'tease'
                : emotionallyLoaded ? 'support' : 'acknowledge'
  const desiredLength = greeting || latest.length <= 45 ? 'very_short'
    : disclosure.depth >= 4 || opts.analysis.isExplicitAdviceRequest ? 'medium' : 'short'
  const topicSourceKind = openLoop ? 'open_loop'
    : selectedTopic ? 'inner_life'
      : relevantMemory ? 'memory' : 'user_message'

  return {
    version: 4,
    mode,
    topic,
    continuity: continuation ? 'continuation' : 'new_turn',
    emotionalWeight: disclosure.depth >= 4 ? 'high' : emotionallyLoaded ? 'high' : disclosure.depth === 3 ? 'medium' : 'normal',
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
        disclosure,
      }),
      continueUntil: disclosure.requiresPause
        ? ['Mark indicates the disclosure has been heard', 'Mark changes the subject', 'the companion makes an intentional transition']
        : emotionallyLoaded
          ? ['Mark changes the subject', 'the need is meaningfully answered', 'the companion intentionally transitions']
          : ['Mark changes the subject', 'the current question or exchange is complete'],
    },
    contract,
    disclosure,
    obligations,
    clarificationNeeded,
    responseRequirements: [
      'Respond to the actual topic and complete the primary reply objective.',
      disclosure.requiresPause
        ? 'Reflect the specific meaning of the disclosure before asking, advising, or changing subjects.'
        : '',
      obligations.includes('offer_quiet_presence')
        ? 'Do not force a question; quiet presence is an acceptable meaningful move.'
        : '',
      obligations.includes('ask_one_grounded_question')
        ? 'Ask at most one grounded question that follows directly from what Mark revealed.'
        : '',
      obligations.includes('fulfill_conversation_contract')
        ? 'It is the companion’s turn under the active agreement; fulfill it in this reply.'
        : '',
      'Stay concise and in character.',
    ].filter(Boolean),
    avoid,
    responseObligation: goal,
    primaryMove,
    topicSource: topicSourceKind,
    selectedTopic,
    callbackAllowed,
    callbackReason: explicitCallback ? 'Mark explicitly referenced prior context.' : openLoop ? 'A genuine unresolved obligation remains.' : relevantMemory ? 'A memory is directly relevant to Mark\'s current topic.' : undefined,
    desiredLength,
    metaphorBudget: disclosure.depth >= 4 && (opts.state?.daily.poeticLanguageBudget ?? 0) > 0 ? 1 : 0,
    prohibitedPatterns: [
      ...(opts.state?.daily.priorDayTopicCooldowns ?? []),
      ...(opts.state?.recentMotifs ?? []),
      !callbackAllowed ? 'callbacks to previous-day topics' : '',
      greeting ? 'self-centered emotional monologue before acknowledging the greeting' : '',
    ].filter(Boolean),
    newDayDetected: Boolean(opts.newDayDetected),
    sceneStatus: opts.state?.scene.status ?? 'active',
  }
}
