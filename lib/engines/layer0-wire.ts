/**
 * Layer 0 → live systems bridge
 *
 * Loads current standing + recent tasks + latest Rhythm,
 * runs the pure evaluateDay, and persists results.
 *
 * This is the only place that should call evaluateDay and write standing.
 */

import { createClient } from '@/utils/supabase/server'
import { fetchLatestStanding } from '@/lib/standing'
import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import { aggregateDomains } from '@/lib/engines/ontology'
import { parseDomains } from '@/lib/skills'
import {
  evaluateDay,
  createEmptyDebt,
  createDefaultTruth,
  type DayEvalResult,
  type RhythmDay,
} from '@/lib/engines/layer0'
import type { LifeDomain } from '@/lib/engines/types'

/**
 * Build a minimal RhythmDay from the external standing service result.
 * Only finalized nights should affect scoring; if we only have a tier,
 * treat it as finalized for the bridge.
 */
function rhythmDayFromStanding(
  date: string | undefined,
  tier: string | undefined,
  totalHours?: number
): RhythmDay | null {
  if (!date || !tier) return null
  return {
    date,
    status: 'finalized',
    totalSleepMinutes:
      typeof totalHours === 'number' ? Math.round(totalHours * 60) : undefined,
  }
}

/**
 * Run Layer 0 evaluation and persist to player_standing.
 * Safe to call after task completion or on a daily roll-up.
 */
export async function runLayer0Evaluation(opts?: {
  /** Extra domains/titles from the task that just completed */
  extraDomains?: string[]
  extraTitles?: string[]
}): Promise<DayEvalResult | null> {
  try {
    const supabase = await createClient()
    const standing = await loadStanding()
    const health = await fetchLatestStanding()

    // Recent completed tasks (last 3 days) for domain aggregates
    const since = new Date()
    since.setDate(since.getDate() - 3)
    const { data: recent } = await supabase
      .from('tasks')
      .select('title, domains, domain, is_completed, completed_at')
      .eq('is_completed', true)
      .gte('completed_at', since.toISOString())
      .limit(80)

    const tags: string[] = [...(opts?.extraDomains || [])]
    const titles: string[] = [...(opts?.extraTitles || [])]
    for (const t of recent || []) {
      tags.push(...parseDomains(t.domains, t.domain))
      if (t.title) titles.push(t.title)
    }

    const aggregates = aggregateDomains(tags, { titles }) as Record<
      LifeDomain,
      number
    >

    const rhythmDay = rhythmDayFromStanding(
      health?.date,
      health?.rhythm?.tier,
      health?.sleep?.totalHours
    )

    // Map persisted debt into Layer 0 shape (lifetime/burned not tracked yet)
    const debt = {
      current: standing.shadow_debt,
      lifetime: standing.shadow_debt, // approximate until we track lifetime
      burned: 0,
    }

    // Truth starts at 1.0; raised only by verified health data later
    const truth = createDefaultTruth()
    if (health?.success && health?.rhythm) {
      // External health data present → slight truth bump
      truth.multiplier = 1.05
      truth.source = 'health-export'
    }

    const result = evaluateDay({
      rhythmDay,
      domainAggregates: aggregates,
      debt,
      truth,
    })

    // Persist through existing standing store
    await saveStanding({
      shadow_debt: result.debt.current,
      consistency_tokens: Number(
        (standing.consistency_tokens + result.tokensEarned).toFixed(2)
      ),
      total_xp: standing.total_xp + result.dualTrack.xp,
      total_gold: standing.total_gold + result.dualTrack.gold,
      last_rhythm_tier: result.rhythmTier,
      last_rhythm_date: health?.date ?? standing.last_rhythm_date,
      last_self_neglect: result.selfNeglect.severity,
    })

    return result
  } catch (e) {
    console.error('runLayer0Evaluation failed', e)
    return null
  }
}
