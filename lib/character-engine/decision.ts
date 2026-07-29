import { getCharacterProfile } from '@/lib/characterStudio'
import type { CompanionDef } from '@/lib/companions'
import type {
  CharacterAnalysis,
  CharacterDecision,
  CharacterState,
} from '@/lib/character-engine/types'

function firstPreferred(
  preferred: CharacterDecision['move'][],
  candidates: CharacterDecision['move'][]
): CharacterDecision['move'] {
  return preferred.find((move) => candidates.includes(move)) ?? candidates[0] ?? preferred[0] ?? 'react'
}

export function decideCharacterResponse(opts: {
  def: CompanionDef | undefined
  analysis: CharacterAnalysis
  state?: CharacterState
}): CharacterDecision {
  const profile = getCharacterProfile(opts.def)
  const preferred = profile.preferredMoves
  const { analysis, state } = opts
  const reasoningCode: string[] = [`intent:${analysis.intent}`, `need:${analysis.need}`]
  const stateInfluence: string[] = []

  let candidates: CharacterDecision['move'][] = ['react']
  let askQuestion = false
  let offerAdvice = false
  let acknowledgeCorrection = false

  switch (analysis.need) {
    case 'repair':
      candidates = ['clarify', 'react']
      acknowledgeCorrection = true
      reasoningCode.push('repair-first')
      break
    case 'be_heard':
      candidates = ['stay', 'comfort', 'observe', 'react']
      askQuestion = profile.questionFrequency === 'often'
      reasoningCode.push('listen-before-fix')
      break
    case 'clarity':
      candidates = ['clarify', 'challenge', 'observe', 'react']
      offerAdvice = analysis.isExplicitAdviceRequest
      askQuestion = !analysis.isExplicitAdviceRequest && profile.questionFrequency !== 'rare'
      reasoningCode.push(analysis.isExplicitAdviceRequest ? 'advice-invited' : 'clarify-first')
      break
    case 'momentum':
      candidates = ['challenge', 'encourage', 'care', 'clarify']
      offerAdvice = true
      reasoningCode.push('next-step')
      break
    case 'celebration':
      candidates = ['react', 'tease', 'encourage', 'share']
      reasoningCode.push('celebrate-without-analysis')
      break
    case 'company':
      candidates = ['stay', 'react', 'share', 'tease']
      reasoningCode.push('presence')
      break
    case 'play':
      candidates = ['tease', 'react', 'share', 'flirt' as never]
      reasoningCode.push('playful-response')
      break
    case 'space':
      candidates = ['stay', 'react']
      reasoningCode.push('respect-space')
      break
    default:
      candidates = ['react', 'clarify', 'share']
      reasoningCode.push('default-react')
  }

  let move = firstPreferred(preferred, candidates.filter(Boolean))

  if (state) {
    if (state.energy <= 25 && move === 'challenge') {
      move = firstPreferred(preferred, ['stay', 'react', 'clarify'])
      stateInfluence.push('low-energy-softened-response')
    }
    if (state.stress >= 75 && move === 'tease') {
      move = firstPreferred(preferred, ['react', 'clarify', 'stay'])
      stateInfluence.push('high-stress-reduced-playfulness')
    }
    if (state.relationship.conflict >= 60 && analysis.intent !== 'correction') {
      move = firstPreferred(preferred, ['clarify', 'stay', 'react'])
      askQuestion = false
      stateInfluence.push('relationship-conflict-caution')
    }
    if (state.relationship.playfulness >= 70 && analysis.intent === 'celebration') {
      move = firstPreferred(preferred, ['tease', 'react', 'share'])
      stateInfluence.push('playful-bond')
    }
  }

  if (analysis.isCorrection) {
    move = 'clarify'
    askQuestion = false
    offerAdvice = false
  }

  if (profile.questionFrequency === 'rare') askQuestion = false

  return {
    move,
    askQuestion,
    offerAdvice,
    acknowledgeCorrection,
    rememberCandidate:
      analysis.isVulnerable ||
      analysis.intent === 'celebration' ||
      analysis.intent === 'correction' ||
      analysis.intent === 'reflection',
    stateInfluence,
    reasoningCode,
  }
}
