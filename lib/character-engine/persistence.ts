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
  if (value.version !== 1 || typeof value.companionSlug !== 'string') return false
  if (typeof value.energy !== 'number' || typeof value.stress !== 'number') return false
  if (typeof value.curiosity !== 'number' || typeof value.confidence !== 'number') return false
  if (!Array.isArray(value.currentGoals)) return false
  if (!Array.isArray(value.unresolvedThoughts) || !Array.isArray(value.recentEvents)) return false
  if (!isRecord(value.relationship)) return false

  for (const key of [
    'trust',
    'comfort',
    'respect',
    'playfulness',
    'admiration',
    'romance',
    'conflict',
    'sharedHistory',
  ]) {
    if (typeof value.relationship[key] !== 'number') return false
  }

  return typeof value.updatedAt === 'string'
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
    : createDefaultCharacterState(opts.companionSlug, now)

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
