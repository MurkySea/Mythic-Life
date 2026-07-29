import type { CharacterAnalysis } from '@/lib/character-engine/types'

const test = (pattern: RegExp, text: string) => pattern.test(text)

export function analyzeCharacterMessage(userText: string): CharacterAnalysis {
  const text = (userText || '').trim()
  const lower = text.toLowerCase()

  const isCorrection = test(
    /\b(?:you (?:read|got|understood)|that's not|that is not|no[,—-]? actually|not what i meant|you're wrong|you are wrong|misread)\b/i,
    lower
  )
  const isExplicitAdviceRequest = test(
    /\b(?:what should i do|what do you think i should|give me advice|help me decide|how would you|what's the best way|what is the best way|any suggestions|what might i need)\b/i,
    lower
  )
  const isExplicitFlirtation = test(
    /\b(?:kiss me|come closer|hold me|want you|miss your touch|flirt with me|you're beautiful|you are beautiful)\b/i,
    lower
  )
  const isVulnerable = test(
    /\b(?:afraid|scared|ashamed|hurt|alone|overwhelmed|exhausted|grief|lost|can't sleep|cannot sleep|i feel|i felt|running on fumes|drained|burned out|burnt out|i (?:do not|don't) know what i need)\b/i,
    lower
  )
  const asksQuestion = /\?\s*$/.test(text) || /^(?:who|what|when|where|why|how|should|could|would|do|does|did|is|are|can)\b/i.test(lower)

  let intent: CharacterAnalysis['intent'] = 'unknown'
  let need: CharacterAnalysis['need'] = 'unknown'
  let confidence = 0.55

  if (isCorrection) {
    intent = 'correction'
    need = 'repair'
    confidence = 0.96
  } else if (isExplicitFlirtation) {
    intent = 'flirting'
    need = 'play'
    confidence = 0.92
  } else if (isExplicitAdviceRequest) {
    intent = 'advice'
    need = 'clarity'
    confidence = 0.94
  } else if (test(/\b(?:i did it|finished|got it done|good news|won|passed|finally|proud of)\b/i, lower)) {
    intent = 'celebration'
    need = 'celebration'
    confidence = 0.88
  } else if (test(/\b(?:help me plan|plan this|schedule|roadmap|next steps|break this down)\b/i, lower)) {
    intent = 'planning'
    need = 'momentum'
    confidence = 0.9
  } else if (test(/\b(?:haha|lol|lmao|kidding|joking|that's funny|that is funny)\b/i, lower)) {
    intent = 'humor'
    need = 'play'
    confidence = 0.86
  } else if (isVulnerable || test(/\b(?:i'm so tired of|i am so tired of|this sucks|i hate this|i need to vent)\b/i, lower)) {
    intent = 'venting'
    need = 'be_heard'
    confidence = 0.84
  } else if (test(/\b(?:stay with me|keep me company|talk to me|don't leave|do not leave)\b/i, lower)) {
    intent = 'company'
    need = 'company'
    confidence = 0.91
  } else if (test(/\b(?:i've been thinking|i have been thinking|what does it mean|why am i|why do i|reflect)\b/i, lower)) {
    intent = 'reflection'
    need = 'clarity'
    confidence = 0.76
  } else if (test(/^(?:hey|hi|hello|morning|good morning|good night|evening)\b/i, lower)) {
    intent = 'greeting'
    need = 'company'
    confidence = 0.82
  } else if (asksQuestion) {
    intent = 'advice'
    need = 'clarity'
    confidence = 0.64
  }

  return {
    intent,
    need,
    confidence,
    isVulnerable,
    isCorrection,
    isExplicitAdviceRequest,
    isExplicitFlirtation,
    asksQuestion,
  }
}
