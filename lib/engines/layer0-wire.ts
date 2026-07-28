/**
 * Layer 0 → live systems bridge (complete)
 *
 * Responsibilities:
 * 1. Safe per-task incremental rewards using Layer 0 multipliers
 * 2. Idempotent daily Rhythm → Debt / Trust application (once per rhythm date)
 * 3. Push Trust deltas into active party companions (dual-axis primary write)
 * 4. Trigger reactive companions when a new rhythm day is applied
 * 5. Refresh World Integrity after daily rhythm
 * 6. Rough-night streaks → companion memory (soft)
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
import {
  applyRhythmToCompanion,
  companionScorePatch,
} from '@/lib/engines/relationship-wire'
import { reactCompanionsToLayer0 } from '@/lib/engines/reactive-companions'
import { refreshWorldIntegrity } from '@/lib/engines/world-integrity-wire'
import { scoreNightWithLadder } from '@/lib/engines/baseline-wire'
import { recordRoughNightMemory } from '@/lib/memory'
import type { LifeDomain } from '@/lib/engines/types'

function asRhythmTier(t: string | null | undefined): RhythmTier | null {
  if (!t) return null
  const allowed: RhythmTier[] = [
    'Excellent',
    'Elite',
    'Good',
    'Strong',
    'Neutral',
    'Steady',
    'Poor',
    'Fragile',
    'Bad',
    'Broken',
  ]
  return (allowed as string[]).includes(t) ? (t as RhythmTier) : null
}

async function applyDailyRhythmIfNeeded(): Promise<{
  applied: boolean
  tier: RhythmTier | null
  trustDeltas: { slug: string; bondXpDelta: number; affinityDelta: number }[]
  usedLadder: boolean
}> {
  const standing = await loadStanding()
  const health = await fetchLatestStanding()
  const rhythmDate = health?.date || null

  let tier: RhythmTier | null = null
  let debtDelta = 0
  let usedLadder = false
  let nextPhase = standing.baseline_phase
  let nextStreak = standing.baseline_good_streak

  if (health?.sleep?.bedtime && health?.sleep?.wakeTime && rhythmDate) {
    const ladder = scoreNightWithLadder(
      standing,
      {
        bedtimeIso: health.sleep.bedtime,
        wakeIso: health.sleep.wakeTime,
        totalSleepHours: health.sleep.totalHours ?? null,
        restingHeartRate: health.signals?.restingHeartRate ?? null,
        hrvMs: health.signals?.hrv ?? null,
        activeEnergyKcal: health.signals?.activeEnergyKcal ?? null,
      },
      rhythmDate
    )
    if (ladder) {
      usedLadder = true
      tier = ladder.tier as RhythmTier
      debtDelta = ladder.effects.shadowDebtDelta
      nextPhase = ladder.nextProgress.currentPhase
      nextStreak = ladder.nextProgress.goodStreak
    }
  }

  if (!tier) {
    tier = asRhythmTier(health?.rhythm?.tier) || null
    if (tier === 'Bad' || tier === 'Broken') debtDelta = 4
    else if (tier === 'Poor' || tier === 'Fragile') debtDelta = 2
    else debtDelta = 0
  }

  if (!tier || !rhythmDate) {
    return { applied: false, tier: null, trustDeltas: [], usedLadder: false }
  }

  if (standing.last_rhythm_date === rhythmDate) {
    return { applied: false, tier, trustDeltas: [], usedLadder }
  }

  let debt = standing.shadow_debt
  if (debtDelta > 0) {
    debt = debt + debtDelta
  } else if (debtDelta < 0) {
    debt = Math.max(0, debt + debtDelta)
  }

  const { party } = await loadPlayerState()
  const supabase = await createClient()
  const trustDeltas: { slug: string; bondXpDelta: number; affinityDelta: number }[] =
    []

  for (const member of party.members) {
    try {
      const { data: row } = await supabase
        .from('companion')
        .select(
          'id, slug, affinity_score, bond_xp, consecutive_bad_days, consecutive_good_days, trust_score, intimacy_score'
        )
        .eq('slug', member.slug)
        .maybeSingle()

      if (!row) continue

      const result = applyRhythmToCompanion(
        {
          slug: member.slug,
          affinity_score: Number(row.affinity_score) || 1,
          bond_xp: Number(row.bond_xp) || 0,
          consecutive_bad_days:
            row.consecutive_bad_days != null
              ? Number(row.consecutive_bad_days)
              : null,
          consecutive_good_days:
            row.consecutive_good_days != null
              ? Number(row.consecutive_good_days)
              : null,
          trust_score: row.trust_score != null ? Number(row.trust_score) : null,
          intimacy_score:
            row.intimacy_score != null ? Number(row.intimacy_score) : null,
        },
        tier,
        rhythmDate
      )

      const nextBond = Math.max(0, (Number(row.bond_xp) || 0) + result.bondXpDelta)
      const nextAff = Math.max(
        1,
        Math.round(((Number(row.affinity_score) || 1) + result.affinityDelta) * 10) / 10
      )

      const patch = companionScorePatch({
        affinity: nextAff,
        bondXp: nextBond,
        consecutiveBadDays: result.consecutiveBadDays,
        consecutiveGoodDays: result.consecutiveGoodDays,
        trustScore: result.trustAfter,
        intimacyScore: result.intimacyAfter,
      })

      try {
        await supabase.from('companion').update(patch).eq('id', row.id)
      } catch (writeErr) {
        await supabase
          .from('companion')
          .update({ bond_xp: nextBond, affinity_score: nextAff })
          .eq('id', row.id)
        console.error('companion dual-axis write failed, fell back', writeErr)
      }

      // Soft memory: rough nights compound into what she remembers
      if (result.consecutiveBadDays >= 2) {
        try {
          await recordRoughNightMemory(member.slug, result.consecutiveBadDays)
        } catch (memErr) {
          console.error('rough night memory failed', member.slug, memErr)
        }
      }

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
    baseline_phase: nextPhase,
    baseline_good_streak: nextStreak,
  })

  try {
    await reactCompanionsToLayer0({ force: false })
  } catch (e) {
    console.error('reactive companions after rhythm', e)
  }

  try {
    await refreshWorldIntegrity()
  } catch (e) {
    console.error('world integrity refresh failed', e)
  }

  return { applied: true, tier, trustDeltas, usedLadder }
}

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
    const daily = await applyDailyRhythmIfNeeded()

    const standing = await loadStanding()
    const health = await fetchLatestStanding()
    const tier: RhythmTier =
      daily.tier ||
      asRhythmTier(health?.rhythm?.tier) ||
      asRhythmTier(standing.last_rhythm_tier) ||
      'Neutral'

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

    let debt = standing.shadow_debt
    if (daily.applied && neglect.recommendedDebtWeight > 0) {
      debt = accumulateShadowDebt(
        { current: debt, lifetime: debt, burned: 0 },
        neglect.recommendedDebtWeight
      ).current
    }

    const truth = createDefaultTruth()
    if (health?.success && health?.rhythm) {
      truth.multiplier = 1.05
      truth.source = 'health-export'
    }

    const stack = buildMultiplierStack({
      rhythmTier: tier,
      truth: truth.multiplier,
      shadowDebt: debt,
      selfNeglect: neglect.selfMultiplier,
    })

    const domainCount = Math.max(1, (opts?.extraDomains || []).length)
    const baseXp = 12 * domainCount
    const baseGold = 6 * domainCount
    const xpGain = Math.round(baseXp * stack.combined)
    const goldGain = Math.round(baseGold * stack.combined)

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

    try {
      await refreshWorldIntegrity()
    } catch {
      /* non-fatal */
    }

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

export async function runLayer0DailyClose(): Promise<void> {
  await applyDailyRhythmIfNeeded()
}
