/**
 * Apply a rolled loot drop to player standing / companion scores.
 */

import { createClient } from '@/utils/supabase/server'
import { loadStanding, saveStanding } from './standing-store'
import type { LootDrop } from './loot'
import { getCompanionDef } from '@/lib/companions'

export async function applyLootDrop(
  drop: LootDrop,
  companionSlug: string
): Promise<void> {
  if (drop.kind === 'nothing' || drop.amount <= 0) return

  if (drop.kind === 'gold' || drop.kind === 'token') {
    const standing = await loadStanding()
    if (drop.kind === 'gold') {
      await saveStanding({ total_gold: standing.total_gold + drop.amount })
    } else {
      await saveStanding({
        consistency_tokens: Number(
          (standing.consistency_tokens + drop.amount).toFixed(2)
        ),
      })
    }
    return
  }

  if (drop.kind === 'affinity' || drop.kind === 'scene_credit') {
    // Scene credit is stored as +1 affinity (unlocks another scene milestone sooner)
    // Affinity crumb is the same mechanical path with amount 1
    const supabase = await createClient()
    const def = getCompanionDef(companionSlug)
    const { data: companion } = await supabase
      .from('companion')
      .select('id, affinity_score')
      .or(`slug.eq.${companionSlug},name.eq.${def?.name || 'Seraphine'}`)
      .maybeSingle()

    if (!companion) return

    const next = (companion.affinity_score || 1) + drop.amount
    await supabase
      .from('companion')
      .update({ affinity_score: next })
      .eq('id', companion.id)
  }
}
