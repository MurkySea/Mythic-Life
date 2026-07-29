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
  if (!isRecord(value.relationship) || !Array.isArray(value.currentGoals)) return false
  return true
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
