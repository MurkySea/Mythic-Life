import type {
  CharacterAnalysis,
  CharacterDecision,
  CharacterState,
  ConversationDirection,
} from '@/lib/character-engine/types'
import type { CuriosityIntent } from '@/lib/character-engine/curiosity'
import { formatCuriosityBlock } from '@/lib/character-engine/curiosity'
import type { AttentionIntent } from '@/lib/character-engine/attention'
import { formatAttentionBlock } from '@/lib/character-engine/attention'
import { coreIdentityFor, formatCoreIdentity } from '@/lib/character-engine/identity'

export function characterEnginePromptBlock(opts: {
  analysis: CharacterAnalysis
  decision: CharacterDecision
  direction: ConversationDirection
  state?: CharacterState
  curiosity?: CuriosityIntent
  attention?: AttentionIntent
}): string {
  const { analysis, decision, direction, state, curiosity, attention } = opts
  const identity = coreIdentityFor(state?.companionSlug ?? 'unknown')
  const stateLines = state
    ? [
        `Mood: ${state.mood}`,
        `Energy: ${Math.round(state.energy)}/100`,
        `Stress: ${Math.round(state.stress)}/100`,
        `Curiosity: ${Math.round(state.curiosity)}/100`,
        `Confidence: ${Math.round(state.confidence)}/100`,
        `Relationship: trust ${Math.round(state.relationship.trust)}, comfort ${Math.round(state.relationship.comfort)}, respect ${Math.round(state.relationship.respect)}, playfulness ${Math.round(state.relationship.playfulness)}, romance ${Math.round(state.relationship.romance)}, conflict ${Math.round(state.relationship.conflict)}`,
      ]
    : ['No persistent state supplied. Do not invent internal events or feelings.']

  const contractLines = direction.contract?.active
    ? [
        'ACTIVE: yes — this is a binding conversational agreement, not flavor text.',
        `Type: ${direction.contract.type}`,
        `Next actor: ${direction.contract.nextActor}`,
        direction.contract.nextActor === 'companion'
          ? 'MUST HONOR THIS TURN. Fulfill the agreement before changing the interaction pattern.'
          : 'Waiting on Mark. Do not seize the turn or abandon the agreement.',
        `Agreement source: ${direction.contract.source}`,
      ]
    : ['ACTIVE: no. There is no conversation contract in force.']

  const curiositySection = curiosity
    ? `\nCURIOSITY ABOUT HIM\n${formatCuriosityBlock(curiosity)}\n`
    : ''
  const attentionSection = attention?.active
    ? `\nEVIDENCE OF ATTENTION\n${formatAttentionBlock(attention)}\n`
    : ''

  return `CHARACTER ENGINE V2
CORE BEHAVIORAL IDENTITY
${formatCoreIdentity(identity)}

Detected intent: ${analysis.intent}
Likely need: ${analysis.need}
Analysis confidence: ${analysis.confidence.toFixed(2)}
Dominant response move: ${decision.move}
Ask a question: ${decision.askQuestion ? 'yes, at most one' : 'no'}
Offer advice: ${decision.offerAdvice ? 'yes, one concrete thought maximum unless asked for more' : 'no'}
Acknowledge a correction immediately: ${decision.acknowledgeCorrection ? 'yes' : 'no'}
Memory candidate: ${decision.rememberCandidate ? 'yes' : 'no'}
Decision codes: ${decision.reasoningCode.join(', ')}
State modifiers: ${decision.stateInfluence.join(', ') || 'none'}

CONVERSATION INTENT ENGINE
Mode: ${direction.mode}
Topic already in progress: ${direction.topic}
Turn relationship: ${direction.continuity}
Emotional weight: ${direction.emotionalWeight}
Conversation goal: ${direction.goal}
Primary reply objectives, in order:
${direction.objectives.map((objective, index) => `${index + 1}. ${objective}`).join('\n')}
Clarification genuinely required: ${direction.clarificationNeeded ? 'yes' : 'no'}
Primary move: ${direction.primaryMove}
Topic source: ${direction.topicSource}
Selected topic: ${direction.selectedTopic || 'the user message'}
Callback authorized: ${direction.callbackAllowed ? `yes â€” ${direction.callbackReason || 'relevant current context'}` : 'no'}
Desired length: ${direction.desiredLength}
Metaphor budget: ${direction.metaphorBudget}
New day detected: ${direction.newDayDetected ? 'yes' : 'no'}

DISCLOSURE WEIGHT
Depth: ${direction.disclosure.depth}/5
Categories: ${direction.disclosure.categories.join(', ') || 'none'}
Requires the conversation to pause: ${direction.disclosure.requiresPause ? 'yes' : 'no'}
Reasons: ${direction.disclosure.rationale.join('; ') || 'ordinary conversational content'}

CONVERSATION CONTRACT
${contractLines.join('\n')}

RESPONSE OBLIGATIONS
${direction.obligations.length ? direction.obligations.map((item) => `- ${item}`).join('\n') : '- No special obligation beyond the reply objectives.'}
${curiositySection}
${attentionSection}
CONVERSATION MOMENTUM
Active topic: ${direction.momentum.activeTopic}
Active for approximately ${direction.momentum.activeTurns} user turns
Trajectory: ${direction.momentum.trajectory}
Continue this thread until:
${direction.momentum.continueUntil.map((item) => `- ${item}`).join('\n')}

Required response moves:
${direction.responseRequirements.map((item) => `- ${item}`).join('\n')}
Avoid:
${direction.avoid.length ? direction.avoid.map((item) => `- ${item}`).join('\n') : '- Nothing beyond the normal character rules.'}

Do not reset the topic merely because Mark used a short follow-up. Acknowledgment alone is not a complete reply when the objective includes comfort, trust, exploration, or a next step. A depth-4 or depth-5 disclosure must visibly affect the response. An active conversation contract must be honored before the companion changes the interaction pattern. Curiosity never overrides a correction, a heavy disclosure, or the primary reply objective.

CURRENT CHARACTER STATE
${stateLines.join('\n')}

DAILY LIFE
${state ? `Local date: ${state.daily.localDate}\nPrimary intent: ${state.daily.primaryIntent}\nSecondary intent: ${state.daily.secondaryIntent || 'none'}\nSocial energy: ${state.daily.socialEnergy}/100\nConversational appetite: ${state.daily.conversationalAppetite}/100\nActive inner-life threads: ${state.innerLife.filter((item) => item.status === 'active').map((item) => item.label).slice(0, 3).join('; ') || 'none'}\nPrior-day topic cooldowns: ${state.daily.priorDayTopicCooldowns.join('; ') || 'none'}\nRecent motif penalties: ${state.recentMotifs.join('; ') || 'none'}` : 'No persistent daily state supplied.'}

VOICE CONTRACT
Speak concretely by default. Metaphor is optional and may not exceed the stated budget. Do not use vague atmosphere as a substitute for meaning. Personality comes from values, choices, observations, humor, boundaries, and reactionsâ€”not repeated vocabulary. A new day is a new chapter unless the director authorizes a callback.

PROHIBITED THIS TURN
${direction.prohibitedPatterns.map((item) => `- ${item}`).join('\n') || '- none beyond the normal rules'}

Treat these as behavioral constraints, not dialogue to quote. The director understands the conversation and sets the obligations; the character engine selects the response strategy; you write the natural message.`
}
