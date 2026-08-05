import type {
  CharacterMood,
  CharacterRelationship,
  CharacterState,
} from '@/lib/character-engine/types'
import { initializeDailyState, localDateFor, rollDailyBoundary } from '@/lib/character-engine/living'

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
    emotionalSafety: 20,
    vulnerability: 10,
    familiarity: 10,
    protectiveness: 15,
    independence: 75,
    dependency: 5,
    conflictStrain: 0,
    repairStatus: 'clear',
  }
}

export function createDefaultCharacterState(
  companionSlug: string,
  now = new Date(),
  timeZone = 'America/Chicago'
): CharacterState {
  const daily = initializeDailyState({ companionSlug, now, timeZone })
  const innerLife = companionSlug === 'seraphine'
    ? [
        { id: 'herb-garden', kind: 'project' as const, label: 'learning which herbs survive her impatient gardening', status: 'active' as const, salience: 62, updatedAt: now.toISOString() },
        { id: 'book-notes', kind: 'interest' as const, label: 'finishing a difficult book and forming an opinion about its ending', status: 'active' as const, salience: 54, updatedAt: now.toISOString() },
        { id: 'plain-truth', kind: 'goal' as const, label: 'practicing saying what she means without hiding behind beautiful language', status: 'active' as const, salience: 68, updatedAt: now.toISOString() },
      ]
    : [{ id: 'personal-craft', kind: 'project' as const, label: 'developing a craft rooted in their own values', status: 'active' as const, salience: 50, updatedAt: now.toISOString() }]
  return {
    version: 2,
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
    evolvingIdentity: {
      confidence: 50, assertiveness: 42, initiative: 45, playfulness: 35,
      humorComfort: 32, emotionalOpenness: 38, resilience: 55, independence: 72,
      optimism: 58, willingnessToDisagree: 42, willingnessToAskForHelp: 28,
      affectionComfort: 35,
    },
    innerLife,
    daily: { ...daily, activeInterestIds: innerLife.map((item) => item.id).slice(0, 3) },
    scene: {
      id: `${companionSlug}:${localDateFor(now, timeZone)}`,
      startedAt: now.toISOString(), localDate: localDateFor(now, timeZone),
      topicIds: [], unresolvedObligations: [], status: 'active',
    },
    recentMotifs: [],
    reflections: [],
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
  opts: { now?: Date; elapsedHours?: number; timeZone?: string } = {}
): CharacterState {
  const now = opts.now ?? new Date()
  const boundary = rollDailyBoundary(current, now, opts.timeZone)
  current = boundary.state
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
      conflictStrain: clamp(current.relationship.conflictStrain - Math.min(6, elapsedHours * 0.08)),
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
    relationship.emotionalSafety = clamp(relationship.emotionalSafety + 0.8)
    relationship.familiarity = clamp(relationship.familiarity + 0.5)
    stress = clamp(stress - 2)
  }

  if (outcome.vulnerable) {
    relationship.trust = clamp(relationship.trust + 1.5)
    relationship.comfort = clamp(relationship.comfort + 1.2)
    relationship.vulnerability = clamp(relationship.vulnerability + 0.8)
    relationship.emotionalSafety = clamp(relationship.emotionalSafety + 1)
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
    relationship.conflictStrain = clamp(relationship.conflictStrain + 8)
    relationship.repairStatus = 'needed'
    stress = clamp(stress + 6)
  }

  if (outcome.correction) {
    confidence = clamp(confidence - 2)
    relationship.respect = clamp(relationship.respect + 0.8)
    relationship.repairStatus = 'in_progress'
  }

  const next: CharacterState = {
    ...current,
    energy,
    stress,
    confidence,
    relationship,
    evolvingIdentity: {
      ...current.evolvingIdentity,
      confidence: clamp(current.evolvingIdentity.confidence + (outcome.positive ? 0.15 : outcome.conflict ? -0.12 : 0)),
      resilience: clamp(current.evolvingIdentity.resilience + (outcome.correction ? 0.08 : 0)),
      playfulness: clamp(current.evolvingIdentity.playfulness + (outcome.playful ? 0.18 : 0)),
      emotionalOpenness: clamp(current.evolvingIdentity.emotionalOpenness + (outcome.vulnerable ? 0.12 : 0)),
      willingnessToDisagree: clamp(current.evolvingIdentity.willingnessToDisagree + (outcome.correction ? 0.06 : 0)),
    },
    recentEvents: outcome.event
      ? [...current.recentEvents, outcome.event].slice(-8)
      : current.recentEvents,
    updatedAt: now.toISOString(),
  }

  return { ...next, mood: moodFromState(next) }
}
