/**
 * Layer 1 — Reactive Companions
 *
 * Companions react to Layer 0 outcomes (Rhythm, Shadow Debt, consistency).
 * Pure mood mapping + live schedule bridge.
 *
 * Does not invent new scoring. Reads standing + party, uses party-doctrine,
 * schedules through existing outreach.
 */

import { loadStanding } from '@/lib/engines/standing-store'
import { loadPlayerState } from '@/lib/player-state'
import { fetchLatestStanding } from '@/lib/standing'
import {
  buildUnitReaction,
  partyMoodFromSignals,
  lifeSignalSeed,
  type PartyMood,
  type PartyMoodInput,
  type LifeSignalKind,
} from '@/lib/engines/party-doctrine'
import type { RhythmTier } from '@/lib/engines/relationship'
import { maybeSchedulePartyUnitReaction } from '@/lib/outreach'

/** Map any RhythmTier (including aliases) into doctrine's mood input tier. */
function toMoodTier(
  tier: string | null | undefined
): PartyMoodInput['recentTier'] {
  switch (tier) {
    case 'Excellent':
    case 'Elite':
      return 'Excellent'
    case 'Good':
    case 'Strong':
      return 'Good'
    case 'Poor':
    case 'Fragile':
      return 'Poor'
    case 'Bad':
    case 'Broken':
      return 'Bad'
    case 'Neutral':
    case 'Steady':
    default:
      return 'Neutral'
  }
}

function signalFromTier(tier: string | null | undefined): LifeSignalKind {
  const t = toMoodTier(tier)
  if (t === 'Excellent' || t === 'Good') return 'rhythm_good'
  if (t === 'Poor' || t === 'Bad') return 'rhythm_bad'
  return 'streak'
}

export interface ReactiveSnapshot {
  mood: PartyMood
  tier: string | null
  debt: number
  partySize: number
  speakerSlug: string | null
  seed: string
  secondarySeed?: string
  scheduled: boolean
}

/**
 * Build current party mood from live Layer 0 standing + health.
 */
export async function readPartyMood(): Promise<{
  mood: PartyMood
  input: PartyMoodInput
  tier: string | null
}> {
  const standing = await loadStanding()
  const health = await fetchLatestStanding()
  const tier =
    health?.rhythm?.tier || standing.last_rhythm_tier || null

  const input: PartyMoodInput = {
    recentTier: toMoodTier(tier),
    shadowDebt: standing.shadow_debt,
    // leaderTrust left undefined until we persist a single leader trust number
  }

  return {
    mood: partyMoodFromSignals(input),
    input,
    tier,
  }
}

/**
 * Primary reactive entry: after Layer 0 daily rhythm applies (or on demand).
 * Builds unit reaction and schedules outreach if party is non-empty.
 */
export async function reactCompanionsToLayer0(opts?: {
  force?: boolean
  preferSlug?: string
}): Promise<ReactiveSnapshot | null> {
  try {
    const { party } = await loadPlayerState()
    if (party.members.length === 0) return null

    const { mood, input, tier } = await readPartyMood()
    const reaction = buildUnitReaction(party, input, opts?.preferSlug)

    if (!reaction.speakerSlug) return null

    const signal = signalFromTier(tier)
    const detail =
      tier != null
        ? `Rhythm ${tier}, debt ${input.shadowDebt ?? 0}`
        : undefined

    // Enrich seed with life signal line for the generator
    const signalLine = lifeSignalSeed(signal, detail)
    const fullSeed = `${signalLine} ${reaction.seed}`

    const scheduled = await maybeSchedulePartyUnitReaction({
      signal,
      detail,
      moodInput: input,
      force: opts?.force ?? false,
    })

    return {
      mood,
      tier,
      debt: input.shadowDebt ?? 0,
      partySize: party.members.length,
      speakerSlug: reaction.speakerSlug,
      seed: fullSeed,
      secondarySeed: reaction.secondarySeed,
      scheduled,
    }
  } catch (e) {
    console.error('reactCompanionsToLayer0 failed', e)
    return null
  }
}

/**
 * Lighter hook for place / geo signals — still party-aware.
 */
export async function reactCompanionsToPlace(opts: {
  placeId: string
  event: 'arrive' | 'leave' | 'checkin'
  force?: boolean
}): Promise<boolean> {
  const signal: LifeSignalKind =
    opts.event === 'leave' ? 'place_leave' : 'place_arrive'

  const { input } = await readPartyMood()

  return maybeSchedulePartyUnitReaction({
    signal,
    detail: opts.placeId,
    moodInput: input,
    force: opts.force,
  })
}
