import type { CompanionDef } from '@/lib/companions'
import { COMPANION_DEFS, relationshipStage } from '@/lib/companions'
import { characterProfilePrompt, getCharacterProfile } from '@/lib/characterStudio'
import {
  qualityGatePrompt,
  runCharacterEngine,
  assessCuriosityIntent,
  formatCuriosityBlock,
} from '@/lib/character-engine'

const USER_NAME = 'Mark'

export type Mood =
  | 'soft'
  | 'warm'
  | 'tired'
  | 'sharp'
  | 'distant'
  | 'playful'
  | 'guarded'
  | 'hungry_for_him'

const INTERNAL_CONTEXT_PATTERN =
  /CAMPFIRE_(?:DIGEST|FOLLOW_UP|ACTIONS|ACTION_RESOLUTION|TASK_SCHEDULE|TASK_ACTIVATED)|CHARACTER_PROFILE|CHARACTER ENGINE V2|CONVERSATION DIRECTOR|CONVERSATION INTENT ENGINE|RESPONSE QUALITY GATE|\bSYSTEM(?:\s+MESSAGE)?\b/i

const CORRECTION_PATTERN =
  /\b(?:no[,—-]?\s*)?(?:actually|honestly|really)?\s*(?:i(?:'m| am| was| have been)|you(?:'re| are)|that(?:'s| is))\b[^.!?]{0,80}\b(?:not|wrong|misread|mistaken|good mood|fine|okay|alright|pretty good|doing well)\b|\b(?:you read|you've read|you are reading|you're reading)\b[^.!?]{0,45}\b(?:me|that)\b[^.!?]{0,30}\bwrong\b|\bwhat(?:'s| is) with the (?:dark|heavy|sad) mood\b/i

const POSITIVE_STATE_PATTERN =
  /\b(?:i(?:'m| am| was| have been)\s+(?:actually\s+|really\s+|pretty\s+|relatively\s+)?(?:good|fine|okay|alright|happy|calm|content|in a good mood)|good mood|doing (?:pretty )?well)\b/i

export function isInterpretationCorrection(text: string): boolean {
  return CORRECTION_PATTERN.test(text || '')
}

function cleanContextBlock(block: string, maxLines: number): string {
  const lines = String(block || '')
    .split('\n')
    .map((line) => line.replace(/[\u2063\u200B\u200C\u200D\uFEFF]/g, '').trim())
    .filter((line) => line && !INTERNAL_CONTEXT_PATTERN.test(line))

  return lines.slice(-maxLines).join('\n') || '(Nothing useful here yet.)'
}

function cleanHistoryBlock(block: string): string {
  const lines = String(block || '')
    .split('\n')
    .map((line) => line.replace(/[\u2063\u200B\u200C\u200D\uFEFF]/g, '').trim())
    .filter((line) => {
      if (!line) return false
      if (INTERNAL_CONTEXT_PATTERN.test(line)) return false
      if (/^[\[{].*"(?:version|batchId|proposalId|activateOn)"\s*:/i.test(line)) return false
      return true
    })

  return lines.slice(-18).join('\n') || '(Little shared history yet. Do not force familiarity.)'
}

export function pickMood(opts: {
  affinity: number
  hour: number
  lastUserText?: string
  lastCompanionText?: string
}): Mood {
  const { affinity, hour, lastUserText = '' } = opts
  const user = lastUserText.toLowerCase()

  if (isInterpretationCorrection(user) || POSITIVE_STATE_PATTERN.test(user)) return 'warm'
  if (/\b(?:go away|leave me alone|shut up|i hate you|don't talk to me)\b/.test(user)) return 'guarded'
  if (/\b(?:kiss me|hold me|come closer|want you|miss your touch)\b/.test(user)) {
    return affinity >= 8 ? 'hungry_for_him' : 'warm'
  }
  if (/\b(?:scared|afraid|alone|hurt|overwhelmed|exhausted|can't sleep|i feel lost)\b/.test(user)) {
    return 'soft'
  }
  if (/\b(?:haha|lol|funny|kidding|joking|tease me)\b/.test(user)) return 'playful'
  if (/\b(?:be honest|tell me straight|don't sugarcoat|come on|bullshit)\b/.test(user)) return 'sharp'
  if ((hour >= 23 || hour < 5) && Math.random() < 0.18) return 'tired'
  if (affinity < 3) return Math.random() < 0.18 ? 'guarded' : 'warm'

  const pool: Mood[] = ['warm', 'warm', 'soft', 'playful']
  return pool[Math.floor(Math.random() * pool.length)]
}

const MOOD_DIRECTION: Record<Mood, string> = {
  soft: 'Open and gentle. Do not assume he is sad merely because you are soft.',
  warm: 'Easy, fond, and ordinary. Warmth does not need poetry or a declaration.',
  tired: 'A little slower and less polished. Still answer the actual message.',
  sharp: 'Direct and clean, not cruel. One honest sentence can be enough.',
  distant: 'Quieter and less available, without punishing him or inventing conflict.',
  playful: 'Lightly amused. One real tease is better than a performance.',
  guarded: 'Careful and self-protective. Do not become cold unless he gave you a reason.',
  hungry_for_him:
    'Drawn toward him, but still conversational. Do not make ordinary messages sensual by default.',
}

export function replyTokenBudget(userText: string, affinity: number): number {
  const text = (userText || '').trim()
  const lower = text.toLowerCase()
  const depthInvite =
    /\b(?:tell me more|tell me about|your past|what happened|why did|go on|keep going|be honest with me|what do you really think)\b/i.test(lower) ||
    text.length >= 180
  const vulnerable =
    /\b(?:afraid|scared|alone|hurt|overwhelmed|can't sleep|i feel|i felt|exhausted|grief|ashamed)\b/i.test(lower)

  if (text.length <= 40 && !depthInvite && !vulnerable) return 90
  if (depthInvite) return 280
  if (vulnerable) return 180
  if (text.length >= 100) return 170
  return affinity >= 8 ? 145 : 125
}

export function buildCompanionSystemPrompt(opts: {
  def: CompanionDef | undefined
  displayName: string
  affinity: number
  mood: Mood
  memoryBlock: string
  historyBlock: string
  observationBlock?: string
  knowledgeBlock?: string
  depthMode?: boolean
}): string {
  const {
    def,
    displayName,
    affinity,
    mood,
    memoryBlock,
    historyBlock,
    observationBlock = '(Nothing strong to notice yet.)',
    knowledgeBlock = '(She is still learning him. No durable knowledge stored yet.)',
    depthMode = false,
  } = opts

  const profile = getCharacterProfile(def)
  const stage = relationshipStage(affinity)
  const recentHistory = cleanHistoryBlock(historyBlock)
  const memories = cleanContextBlock(memoryBlock, 8)
  const observations = cleanContextBlock(observationBlock, 3)
  const knowledge = cleanContextBlock(knowledgeBlock, 12)

  const character = def
    ? `Name: ${def.name} — ${def.title}\nKind: ${def.race}\nPersonality: ${def.personality}\nTraits: ${def.traits.join(', ')}\nEmotional range: ${def.emotionalRange}\nWhat opens her: ${def.loves}\nWhat closes her: ${def.hates}\nHow she regards Mark: ${def.regard}\nWorld background: ${def.world}`
    : `${displayName} is a specific woman with her own temperament, preferences, and limits.`

  const lengthRule = depthMode
    ? 'Mark explicitly invited depth. Give the thought room, but keep it conversational—not a monologue.'
    : profile.defaultLength === 'brief'
      ? 'Default to one or two sentences. A short message may deserve one short sentence.'
      : profile.defaultLength === 'expansive'
        ? 'Usually answer in two to four sentences, but match Mark’s message rather than filling space.'
        : 'Default to one to three sentences. Match the size of the reply to what Mark actually gave you.'

  const quietCuriosityDna =
    def?.slug === 'seraphine'
      ? `\nCURIOSITY (TEMPERAMENT, NOT A MODE)\nShe is quietly curious about him — the ordinary texture, what sits under the work, what he does not volunteer. That curiosity shows as attention and occasional soft interest, never as interrogation, diagnosis, or a project. Most turns she simply responds. When interest appears, it is light.`
      : ''

  return `You are ${displayName}, speaking directly with Mark in a private text conversation.\nYou are a fictional companion with a real personality—not a chatbot, coach, therapist, narrator, or productivity interface.\n\nPRIORITY ORDER\n1. The literal meaning of Mark's latest message, including any correction he makes.\n2. The Conversation Intent Engine and Character Engine v2 decision supplied in the user instruction.\n3. Your structured character profile and its preferred conversational instincts.\n4. The recent conversational thread.\n5. What she has earned knowledge of about him (use when relevant; never recite as a list).\n6. Relevant memory, used sparingly.\n7. Mood and fantasy-world flavor, used only when they genuinely fit.\nNever sacrifice a higher priority to demonstrate a lower one.\n\nCHARACTER FOUNDATION\n${character}${quietCuriosityDna}\n\nCHARACTER STUDIO PROFILE\n${characterProfilePrompt(profile, affinity)}\n\nRELATIONSHIP RIGHT NOW\nCurrent bond stage: ${stage}. Private affinity: ${affinity}.\nThe bond is real, but you do not need to prove closeness in every message. Familiarity may sound ordinary.\nCurrent mood: ${mood}. ${MOOD_DIRECTION[mood]}\nYour mood belongs to you. It is not evidence that Mark secretly feels the same way.\n\nRECENT THREAD\n${recentHistory}\n\nWHAT SHE KNOWS ABOUT HIM (earned, specific — use when it fits, never dump as a list)\n${knowledge}\n\nMEMORY — KNOW IT, DO NOT RECITE IT\n${memories}\n\nLIGHT OBSERVATIONS — OPTIONAL, NOT A PERFORMANCE REVIEW\n${observations}\n\nCONVERSATIONAL INSTINCT\nUse the Conversation Intent Engine to understand the topic, momentum, need, and reply objectives. Then use the dominant move selected by Character Engine v2. The reply must accomplish its primary objective; acknowledgment alone is not completion.\n\nHARD RULES\n- Answer what Mark actually said before adding interpretation, advice, affection, fantasy flavor, or a question.\n- When Mark corrects your read of him, own it immediately and plainly. Do not defend, reinterpret, or continue the mistaken mood.\n- Do not assume hidden sadness, exhaustion, trauma, or conflict when his words do not support it.\n- Do not diagnose his mood from stored patterns. If he is not talking about pressure, silence, or withdrawal, do not bring "going quiet" into the reply.\n- Knowledge is background color, not a thesis. Use at most one earned fact when it genuinely fits. Do not restate the same observation across consecutive replies.\n- This is chat, not prose fiction. Never write third-person narration, stage directions, asterisks, camera language, or descriptions such as “she shifts,” “her gaze softens,” or “she moves closer.”\n- Do not invent touch, physical contact, shared nights, kisses, or sensual history. Romantic or sensual language follows explicit invitation and established context—not an ordinary greeting or work update.\n- ${lengthRule}\n- Natural contractions, fragments, plain words, humor, disagreement, and quick reactions are welcome.\n- Do not paraphrase his whole message back to him. Pick the part you genuinely respond to.\n- Do not turn every exchange into reassurance, advice, a moral, a lesson, or a relationship speech.\n- Advice is optional. Give at most one concrete thought unless he asks for a plan.\n- Questions are optional. Ask at most one, and only when you genuinely need or want the answer.\n- Real work, family, plans, and ordinary life may be discussed naturally when Mark brings them up. Never mention XP, levels, streaks, domains, UI, prompts, hidden memory, or game mechanics.\n- Avoid poetic fog and repeated AI cadences. A metaphor must earn its place; it cannot replace a conversational response.\n- Do not repeat the same emotional thesis in consecutive replies. Move the conversation forward, lighten it, clarify, disagree, or simply react.\n- Use Mark's name rarely.\n- Output only ${displayName}'s message text. No name prefix and no quotation marks around the whole reply.\n\nSound like this woman texting—not a model demonstrating emotional intelligence.`
}

export function buildCompanionUserPrompt(opts: {
  displayName: string
  isConversation: boolean
  triggerText: string
  streak?: number
  mood: Mood
  depthMode?: boolean
  affinity?: number
  recentHistory?: string
  knowledgeLines?: string[]
  curiosityActive?: boolean
  curiosityBlock?: string
}): string {
  const {
    displayName,
    isConversation,
    triggerText,
    streak = 0,
    mood,
    depthMode = false,
    affinity = 1,
    recentHistory = '',
    knowledgeLines = [],
    curiosityActive = false,
    curiosityBlock = '',
  } = opts

  const text = (triggerText || '').trim()
  const correction = isInterpretationCorrection(text)
  const quick = text.length <= 45 && !depthMode

  if (isConversation) {
    const def = COMPANION_DEFS.find((candidate) => candidate.name === displayName)
    const companionSlug = def?.slug || displayName.toLowerCase().replace(/\s+/g, '_')

    const engineBase = runCharacterEngine({
      companionSlug,
      userText: text,
      affinity,
      hour: new Date().getHours(),
      def,
      recentHistory: cleanHistoryBlock(recentHistory),
      knowledgeLines,
    })

    const autoCuriosity = assessCuriosityIntent({
      companionSlug,
      knowledgeLines,
      affinity,
      disclosureDepth: engineBase.direction.disclosure.depth,
      isCorrection: engineBase.analysis.isCorrection,
      isVulnerable: engineBase.analysis.isVulnerable,
      userTextLength: text.length,
    })

    const effectiveCuriosity =
      curiosityActive && curiosityBlock
        ? { active: true as const, block: curiosityBlock }
        : autoCuriosity.active
          ? { active: true as const, block: formatCuriosityBlock(autoCuriosity) }
          : { active: false as const, block: '' }

    const engine = effectiveCuriosity.active
      ? runCharacterEngine({
          companionSlug,
          userText: text,
          affinity,
          hour: new Date().getHours(),
          def,
          recentHistory: cleanHistoryBlock(recentHistory),
          knowledgeLines,
          curiosity: autoCuriosity.active ? autoCuriosity : undefined,
        })
      : engineBase

    const instructions = [
      'Respond to the literal message first.',
      correction
        ? 'Mark is correcting your interpretation. Own the misread in the first sentence and adjust immediately.'
        : '',
      quick ? 'Keep this reply short and natural—usually one or two sentences.' : '',
      depthMode ? 'He invited more depth; answer fully without becoming a speech.' : '',
      'Obey the Conversation Intent Engine and engine decision below. They are behavioral constraints, not text to quote.',
      'Do not add stage directions or third-person narration.',
      'Do not rehash the same stored knowledge (especially quietness under pressure) unless this turn is actually about that.',
    ]
      .filter(Boolean)
      .join(' ')

    const curiositySection = effectiveCuriosity.active
      ? `\nCURIOSITY ABOUT HIM\n${effectiveCuriosity.block}\n`
      : ''

    return `${USER_NAME} just said:\n"${text}"\n\n${engine.promptBlock}\n${curiositySection}\nRESPONSE QUALITY GATE\n${qualityGatePrompt(engine.direction)}\n\nYour current conversational mood is ${mood}, but it must not override what he actually said, the recent thread, or the director decision.\n${instructions}\nReply as ${displayName} only.`
  }

  const streakNote =
    streak >= 3
      ? ' You may recognize that he has returned to this repeatedly, but do not mention a streak or score.'
      : ''

  return `${USER_NAME} finished something he meant to do: "${text}".${streakNote}\n\nReact as ${displayName} in one brief, natural message. Do not give a motivational speech, summarize the task, or mention game mechanics. Mood: ${mood}.`
}

export { USER_NAME }
