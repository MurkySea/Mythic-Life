/**
 * World Integrity live bridge
 */

import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import { fetchLatestStanding } from '@/lib/standing'
import {
  computeWorldIntegrity,
  type WorldIntegrityState,
} from '@/lib/engines/world-integrity'

export async function getWorldIntegrity(): Promise<WorldIntegrityState> {
  const standing = await loadStanding()
  const health = await fetchLatestStanding()

  const tier = health?.rhythm?.tier || standing.last_rhythm_tier || null

  return computeWorldIntegrity({
    rhythmTier: tier,
    shadowDebt: standing.shadow_debt,
    consistencyTokens: standing.consistency_tokens,
    previousValue: standing.world_integrity,
  })
}

/** Recompute and persist. */
export async function refreshWorldIntegrity(): Promise<WorldIntegrityState> {
  const state = await getWorldIntegrity()
  try {
    await saveStanding({ world_integrity: state.value })
  } catch (e) {
    console.error('persist world_integrity failed', e)
  }
  return state
}
