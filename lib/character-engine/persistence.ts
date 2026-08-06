import { advanceCharacterState, createDefaultCharacterState } from '@/lib/character-engine/state'
import type { CharacterState } from '@/lib/character-engine/types'

export type CharacterStateRow = {
  companion_slug: string
  state: unknown
  updated_at: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isCharacterState(value: unknown): value is CharacterState {
  if (!isRecord(value)) return false
  if (value.version !== 2 || typeof value.companionSlug !== 'string') return false
  if (typeof value.energy !== 'number' || typeof value.stress !== 'number') return false
  if (!isRecord(value.relationship) || !Array.isArray(value.currentGoals)) return false
  if (!isRecord(value.evolvingIdentity) || !Array.isArray(value.innerLife)) return false
  if (!isRecord(value.daily) || typeof value.daily.localDate !== 'string') return false
  if (!isRecord(value.scene) || !Array.isArray(value.scene.unresolvedObligations)) return false
  if (!Array.isArray(value.recentMotifs) || !Array.isArray(value.reflections)) return false
  return true
}

function mergeLegacyState(value: unknown, companionSlug: string, now: Date): CharacterState {
  const defaults = createDefaultCharacterState(companionSlug, now)
  if (!isRecord(value)) return defaults
  const relationship = isRecord(value.relationship)
    ? { ...defaults.relationship, ...value.relationship }
    : defaults.relationship
  return {
    ...defaults,
    ...value,
    version: 2,
    companionSlug,
    relationship,
    evolvingIdentity: isRecord(value.evolvingIdentity)
      ? { ...defaults.evolvingIdentity, ...value.evolvingIdentity }
      : defaults.evolvingIdentity,
    innerLife: Array.isArray(value.innerLife) ? value.innerLife as CharacterState['innerLife'] : defaults.innerLife,
    daily: isRecord(value.daily) ? { ...defaults.daily, ...value.daily } as CharacterState['daily'] : defaults.daily,
    scene: isRecord(value.scene) ? { ...defaults.scene, ...value.scene } as CharacterState['scene'] : defaults.scene,
    recentMotifs: Array.isArray(value.recentMotifs) ? value.recentMotifs.map(String).slice(-12) : [],
    reflections: Array.isArray(value.reflections) ? value.reflections as CharacterState['reflections'] : [],
    currentGoals: Array.isArray(value.currentGoals) ? value.currentGoals as CharacterState['currentGoals'] : [],
    unresolvedThoughts: Array.isArray(value.unresolvedThoughts) ? value.unresolvedThoughts as CharacterState['unresolvedThoughts'] : [],
    recentEvents: Array.isArray(value.recentEvents) ? value.recentEvents.map(String).slice(-8) : [],
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now.toISOString(),
  }
}

export function hydrateCharacterState(opts: {
  companionSlug: string
  row?: CharacterStateRow | null
  now?: Date
}): CharacterState {
  const now = opts.now ?? new Date()
  const stored = opts.row?.state
  const base = isCharacterState(stored)
    ? stored
    : mergeLegacyState(stored, opts.companionSlug, now)

  const updatedAt = new Date(base.updatedAt)
  const elapsedHours = Number.isFinite(updatedAt.getTime())
    ? Math.max(0, (now.getTime() - updatedAt.getTime()) / 3_600_000)
    : 0

  return advanceCharacterState(base, { now, elapsedHours })
}

export function serializeCharacterState(state: CharacterState): CharacterStateRow {
  return {
    companion_slug: state.companionSlug,
    state,
    updated_at: state.updatedAt,
  }
}
