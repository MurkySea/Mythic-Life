import type {
  CharacterAnalysis,
  CharacterDecision,
  CharacterState,
  ConversationDirection,
} from '@/lib/character-engine/types'

export function characterEnginePromptBlock(opts: {
  analysis: CharacterAnalysis
  decision: CharacterDecision
  direction: ConversationDirection
  state?: CharacterState
}): string {
  const { analysis, decision, direction, state } = opts
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

  return `CHARACTER ENGINE V2
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

CONVERSATION DIRECTOR
Mode: ${direction.mode}
Topic already in progress: ${direction.topic}
Turn relationship: ${direction.continuity}
Emotional weight: ${direction.emotionalWeight}
Conversation goal: ${direction.goal}
Clarification genuinely required: ${direction.clarificationNeeded ? 'yes' : 'no'}
Required response moves:
${direction.responseRequirements.map((item) => `- ${item}`).join('\n')}
Avoid:
${direction.avoid.length ? direction.avoid.map((item) => `- ${item}`).join('\n') : '- Nothing beyond the normal character rules.'}

Do not reset the topic merely because Mark used a short follow-up. Do not ask him to restate context that is already clear in the recent thread.

CURRENT CHARACTER STATE
${stateLines.join('\n')}

Treat these as behavioral constraints, not dialogue to quote. The director understands the conversation; the character engine selects the response strategy; you write the natural message.`
}
