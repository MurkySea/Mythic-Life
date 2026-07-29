import type {
  CharacterMood,
  CharacterRelationship,
  CharacterState,
} from '@/lib/character-engine/types'

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

function defaultRelationship(): CharacterRelationship {
  return {
    version: 1,
    trust: 20,
    comfort: 20,
    respect: 25,
    playfulness: 10,
    admiration: 15,
    romance: 0,
    conflict: 0,
    sharedHistory: 0,
  }
}

export function createDefaultCharacterState(
  companionSlug: string,
  now = new Date()
): CharacterState {
  return {
    version: 1,
    companionSlug,
    mood: 'warm',
    energy: 72,
    stress: 18,
    curiosity: 55,
    confidence: 55,
    currentGoals: [],
    unresolvedThoughts: [],
    recentEvents: [],
    relationship: defaultRelationship(),
    updatedAt: now.toISOString(),
  }
}

export function moodFromState(state: CharacterState): CharacterMood {
  if (state.stress >= 78) return 'guarded'
  if (state.energy <= 24) return 'tired'
  if (state.relationship.conflict >= 65) return 'distant'
  if (state.relationship.playfulness >= 70 && state.energy >= 55) return 'playful'
  if (state.relationship.romance >= 65 && state.relationship.trust >= 65) return 'hungry_for_him'
  if (state.confidence >= 72 && state.energy >= 50) return 'sharp'
  if (state.stress >= 45 || state.energy <= 42) return 'soft'
  return 'warm'
}

export function advanceCharacterState(
  current: CharacterState,
  opts: { now?: Date; elapsedHours?: number } = {}
): CharacterState {
  const now = opts.now ?? new Date()
  const elapsedHours = Math.max(0, opts.elapsedHours ?? 24)
  const recovery = Math.min(18, elapsedHours * 0.55)
  const thoughtDecay = Math.min(0.18, elapsedHours / 240)

  const next: CharacterState = {
    ...current,
    energy: clamp(current.energy + recovery - current.stress * 0.03),
    stress: clamp(current.stress - recovery * 0.65),
    curiosity: clamp(current.curiosity + Math.min(8, elapsedHours * 0.12)),
    confidence: clamp(current.confidence + Math.min(4, elapsedHours * 0.05)),
    unresolvedThoughts: current.unresolvedThoughts
      .map((thought) => ({
        ...thought,
        importance: clamp(thought.importance * (1 - thoughtDecay)),
      }))
      .filter((thought) => thought.importance >= 15 && !thought.resolvedAt),
    recentEvents: current.recentEvents.slice(-8),
    relationship: {
      ...current.relationship,
      conflict: clamp(current.relationship.conflict - Math.min(8, elapsedHours * 0.1)),
    },
    updatedAt: now.toISOString(),
  }

  return { ...next, mood: moodFromState(next) }
}

export function applyConversationOutcome(
  current: CharacterState,
  outcome: {
    positive?: boolean
    correction?: boolean
    vulnerable?: boolean
    playful?: boolean
    romantic?: boolean
    conflict?: boolean
    event?: string
  },
  now = new Date()
): CharacterState {
  const relationship = { ...current.relationship }
  let stress = current.stress
  let energy = current.energy
  let confidence = current.confidence

  relationship.sharedHistory = clamp(relationship.sharedHistory + 1, 0, 10_000)

  if (outcome.positive) {
    relationship.trust = clamp(relationship.trust + 1.2)
    relationship.comfort = clamp(relationship.comfort + 1)
    relationship.admiration = clamp(relationship.admiration + 0.6)
    stress = clamp(stress - 2)
  }

  if (outcome.vulnerable) {
    relationship.trust = clamp(relationship.trust + 1.5)
    relationship.comfort = clamp(relationship.comfort + 1.2)
    energy = clamp(energy - 1)
  }

  if (outcome.playful) {
    relationship.playfulness = clamp(relationship.playfulness + 1.5)
    energy = clamp(energy + 1)
  }

  if (outcome.romantic && relationship.trust >= 35) {
    relationship.romance = clamp(relationship.romance + 1)
  }

  if (outcome.conflict) {
    relationship.conflict = clamp(relationship.conflict + 8)
    relationship.comfort = clamp(relationship.comfort - 2)
    stress = clamp(stress + 6)
  }

  if (outcome.correction) {
    confidence = clamp(confidence - 2)
    relationship.respect = clamp(relationship.respect + 0.8)
  }

  const next: CharacterState = {
    ...current,
    energy,
    stress,
    confidence,
    relationship,
    recentEvents: outcome.event
      ? [...current.recentEvents, outcome.event].slice(-8)
      : current.recentEvents,
    updatedAt: now.toISOString(),
  }

  return { ...next, mood: moodFromState(next) }
}
