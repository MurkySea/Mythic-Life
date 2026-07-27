/**
 * World Integrity live bridge
 * Computes from standing + optional previous value stored on player_standing.
 */

import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import { fetchLatestStanding } from '@/lib/standing'
import {
  computeWorldIntegrity,
  type WorldIntegrityState,
} from '@/lib/engines/world-integrity'

/**
 * Read current integrity. Uses last_rhythm_tier / debt / tokens from standing.
 * previousValue read from standing.world_integrity if column exists.
 */
export async function getWorldIntegrity(): Promise<WorldIntegrityState> {
  const standing = await loadStanding()
  const health = await fetchLatestStanding()

  const tier =
    health?.rhythm?.tier || standing.last_rhythm_tier || null

  // previous value: optional column; loadStanding may not type it yet
  const prev = (standing as { world_integrity?: number }).world_integrity

  return computeWorldIntegrity({
    rhythmTier: tier,
    shadowDebt: standing.shadow_debt,
    consistencyTokens: standing.consistency_tokens,
    previousValue: typeof prev === 'number' ? prev : null,
  })
}

/**
 * Recompute and persist when possible.
 * Safe if world_integrity column is missing (compute-only).
 */
export async function refreshWorldIntegrity(): Promise<WorldIntegrityState> {
  const state = await getWorldIntegrity()

  try {
    await saveStanding({
      // @ts-expect-error optional column until migrated
      world_integrity: state.value,
    } as Parameters<typeof saveStanding>[0])
  } catch {
    // column may not exist yet — pure compute still works
  }

  return state
}
