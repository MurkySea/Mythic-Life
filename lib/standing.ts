/**
 * Standing client
 * Fetches the latest Rhythm / health result from the mythic_life_data service.
 *
 * Set MYTHIC_DATA_URL in Vercel env (e.g. https://mythic-life-data.vercel.app)
 * Optional: MYTHIC_DATA_SECRET if the health endpoint is protected.
 */

export type RhythmTier = 'Excellent' | 'Good' | 'Neutral' | 'Poor' | 'Bad'

export interface StandingResult {
  success: boolean
  date?: string
  sleep?: {
    bedtimeDisplay?: string
    wakeDisplay?: string
    totalHours?: number
    deep?: number
    rem?: number
    core?: number
  }
  rhythm?: {
    tier: RhythmTier
    contribution: number
    bedDeviationMinutes: number
    wakeDeviationMinutes: number
    rewardEfficiency: number
    consistencyTokenMultiplier: number
    shadowDebtDelta: number
    leaderTrustDelta: number
  }
  signals?: {
    stressProxy: 'low' | 'moderate' | 'high' | 'unknown'
    recoveryProxy: 'good' | 'fair' | 'poor' | 'unknown'
    hrv: number | null
    restingHeartRate: number | null
    steps: number | null
    activeEnergyKcal: number | null
  }
  message?: string
}

const DATA_URL = process.env.MYTHIC_DATA_URL || ''

export async function fetchLatestStanding(): Promise<StandingResult | null> {
  if (!DATA_URL) return null

  try {
    const res = await fetch(`${DATA_URL.replace(/\/$/, '')}/api/latest`, {
      next: { revalidate: 60 }, // cache ~1 min
    })

    if (!res.ok) return null
    const data = await res.json()

    if (!data || data.success === false) return null
    return data as StandingResult
  } catch (e) {
    console.error('fetchLatestStanding failed', e)
    return null
  }
}

/** Human label + color for a Rhythm tier */
export function tierStyle(tier?: RhythmTier): { label: string; color: string } {
  switch (tier) {
    case 'Excellent':
      return { label: 'Excellent', color: 'text-emerald-400' }
    case 'Good':
      return { label: 'Good', color: 'text-sky-400' }
    case 'Neutral':
      return { label: 'Neutral', color: 'text-zinc-300' }
    case 'Poor':
      return { label: 'Poor', color: 'text-amber-400' }
    case 'Bad':
      return { label: 'Bad', color: 'text-red-400' }
    default:
      return { label: '—', color: 'text-zinc-500' }
  }
}
