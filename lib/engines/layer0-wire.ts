/**
 * Layer 0 → live systems bridge (complete)
 *
 * Responsibilities:
 * 1. Safe per-task incremental rewards using Layer 0 multipliers
 * 2. Idempotent daily Rhythm → Debt / Trust application (once per rhythm date)
 * 3. Push Trust deltas into active party companions
 * 4. Trigger reactive companions when a new rhythm day is applied
 *
 * Pure scoring stays in layer0.ts. This file only loads, calls, and persists.
 */

import { createClient } from '@/utils/supabase/server'
import { fetchLatestStanding } from '@/lib/standing'
import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import { aggregateDomains, detectSelfNeglect } from '@/lib/engines/ontology'
import { parseDomains } from '@/lib/skills'
import { loadPlayerState } from '@/lib/player-state'
import {
  buildMultiplierStack,
  earnConsistencyTokens,
  accumulateShadowDebt,
  createDefaultTruth,
  type RhythmTier,
} from '@/lib/engines/layer0'
import { applyRhythmToCompanion } from '@/lib/engines/relationship-wire'
import { reactCompanionsToLayer0 } from '@/lib/engines/reactive-companions'
import type { LifeDomain } from '@/lib/engines/types'

/**
 * Apply today's finalized Rhythm to Shadow Debt and to every active party member's Trust.
 * Runs at most once per last_rhythm_date (idempotent).
 * On first apply for the day, also triggers reactive companion outreach.
 */
async function applyDailyRhythmIfNeeded(): Promise<{
  applied: boolean
  tier: RhythmTier | null
  trustDeltas: { slug: string; bondXpDelta: number; affinityDelta: number }[]
}> {
  const standing = await loadStanding()
  const health = await fetchLatestStanding()
  const tier = (health?.rhythm?.tier as RhythmTier | undefined) || null
  const rhythmDate = health?.date || null

  if (!tier || !rhythmDate) {
    return { applied: false, tier: null, trustDeltas: [] }
  }

  // Already applied this rhythm day
  if (standing.last_rhythm_date === rhythmDate) {
    return { applied: false, tier, trustDeltas: [] }
  }

  // ── Debt from severe rhythm (once per day) ──────────────────────────────
  let debt = standing.shadow_debt
  if (tier === 'Bad' || tier === 'Broken') debt = debt + 4
  else if (tier === 'Poor' || tier === 'Fragile') debt = debt + 2

  // ── Trust → active party ────────────────────────────────────────────────
  const { party } = await loadPlayerState()
  const supabase = await createClient()
  const trustDeltas: { slug: string; bondXpDelta: number; affinityDelta: number }[] =
    []

  for (const member of party.members) {
    try {
      const { data: row } = await supabase
        .from('companion')
        .select('id, slug, affinity_score, bond_xp')
        .eq('slug', member.slug)
        .maybeSingle()

      if (!row) continue

      const result = applyRhythmToCompanion(
        {
          slug: member.slug,
          affinity_score: Number(row.affinity_score) || 1,
          bond_xp: Number(row.bond_xp) || 0,
        },
        tier,
        rhythmDate
      )

      const nextBond = Math.max(0, (Number(row.bond_xp) || 0) + result.bondXpDelta)
      const nextAff = Math.max(
        1,
        Math.round(((Number(row.affinity_score) || 1) + result.affinityDelta) * 10) / 10
      )

      await supabase
        .from('companion')
        .update({
          bond_xp: nextBond,
          affinity_score: nextAff,
        })
        .eq('id', row.id)

      trustDeltas.push({
        slug: member.slug,
        bondXpDelta: result.bondXpDelta,
        affinityDelta: result.affinityDelta,
      })
    } catch (e) {
      console.error('applyRhythmToCompanion failed', member.slug, e)
    }
  }

  await saveStanding({
    shadow_debt: Number(debt.toFixed(1)),
    last_rhythm_tier: tier,
    last_rhythm_date: rhythmDate,
  })

  // ── Reactive companions (Layer 1) — once when the day first lands ───────
  try {
    await reactCompanionsToLayer0({ force: false })
  } catch (e) {
    console.error('reactive companions after rhythm', e)
  }

  return { applied: true, tier, trustDeltas }
}

/**
 * Incremental reward for a single completed task, using Layer 0 multipliers.
 * Does not re-score the whole day — only this task's contribution.
 */
export async function runLayer0Evaluation(opts?: {
  extraDomains?: string[]
  extraTitles?: string[]
}): Promise<{
  xpGain: number
  goldGain: number
  tokenGain: number
  combinedMultiplier: number
  rhythmApplied: boolean
  rhythmTier: RhythmTier | null
} | null> {
  try {
    // 1. Daily rhythm / trust / reactive pass (idempotent)
    const daily = await applyDailyRhythmIfNeeded()

    const standing = await loadStanding()
    const health = await fetchLatestStanding()
    const tier: RhythmTier =
      daily.tier ||
      (health?.rhythm?.tier as RhythmTier | undefined) ||
      (standing.last_rhythm_tier as RhythmTier | undefined) ||
      'Neutral'

    // 2. Self-neglect from recent window (for multiplier only)
    const supabase = await createClient()
    const since = new Date()
    since.setDate(since.getDate() - 3)
    const { data: recent } = await supabase
      .from('tasks')
      .select('title, domains, domain')
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
    const neglect = detectSelfNeglect(aggregates)

    // Optional: add self-neglect debt once when severity is non-none and we just applied rhythm
    let debt = standing.shadow_debt
    if (daily.applied && neglect.recommendedDebtWeight > 0) {
      debt = accumulateShadowDebt(
        { current: debt, lifetime: debt, burned: 0 },
        neglect.recommendedDebtWeight
      ).current
    }

    // 3. Truth (light bump when external health present)
    const truth = createDefaultTruth()
    if (health?.success && health?.rhythm) {
      truth.multiplier = 1.05
      truth.source = 'health-export'
    }

    // 4. Multiplier stack from Layer 0
    const stack = buildMultiplierStack({
      rhythmTier: tier,
      truth: truth.multiplier,
      shadowDebt: debt,
      selfNeglect: neglect.selfMultiplier,
    })

    // 5. Incremental award for *this* task only
    const domainCount = Math.max(1, (opts?.extraDomains || []).length)
    const baseXp = 12 * domainCount
    const baseGold = 6 * domainCount
    const xpGain = Math.round(baseXp * stack.combined)
    const goldGain = Math.round(baseGold * stack.combined)

    // Tokens: small incremental; full gate still respects Rhythm
    let tokenGain = 0
    if (stack.combined >= 0.85) {
      const gated = earnConsistencyTokens({
        taskScore: 30 * domainCount,
        rhythmTier: tier,
        taskFloor: 20,
      })
      tokenGain = Math.min(0.5, gated * 0.25)
      tokenGain = Number(tokenGain.toFixed(2))
    }

    await saveStanding({
      shadow_debt: Number(debt.toFixed(1)),
      consistency_tokens: Number(
        (standing.consistency_tokens + tokenGain).toFixed(2)
      ),
      total_xp: standing.total_xp + xpGain,
      total_gold: standing.total_gold + goldGain,
      last_rhythm_tier: tier,
      last_self_neglect: neglect.severity,
    })

    return {
      xpGain,
      goldGain,
      tokenGain,
      combinedMultiplier: stack.combined,
      rhythmApplied: daily.applied,
      rhythmTier: tier,
    }
  } catch (e) {
    console.error('runLayer0Evaluation failed', e)
    return null
  }
}

/** Explicit daily close — call from cron or end-of-day path if desired. */
export async function runLayer0DailyClose(): Promise<void> {
  await applyDailyRhythmIfNeeded()
}
