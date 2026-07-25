/**
 * Daily Muster — once-per-day claim with variable rewards.
 * Designed to make opening the app feel lucky without replacing quests.
 */

export type MusterRewardKind =
  | 'gold'
  | 'date_coin'
  | 'special_night'
  | 'angel'
  | 'token'

export interface MusterReward {
  kind: MusterRewardKind
  amount: number
  label: string
  rarity: 'common' | 'uncommon' | 'rare' | 'ultra'
  /** Flavor for the banner */
  flavor: string
}

/**
 * Weighted daily muster roll.
 * Soft streak (consecutive days) slightly improves odds of rare+.
 */
export function rollMusterReward(opts?: { streak?: number }): MusterReward {
  const streak = opts?.streak || 0
  const rareBoost = streak >= 7 ? 0.04 : streak >= 3 ? 0.02 : 0
  const r = Math.random()

  // Ultra-rare Angel ~0.8% (+ streak nudge)
  if (r < 0.008 + rareBoost * 0.25) {
    return {
      kind: 'angel',
      amount: 1,
      label: 'An Angel answers',
      rarity: 'ultra',
      flavor: 'Affinity to every domain. She was never on the skill tree — only the muster.',
    }
  }

  // Rare special night scene ~6%
  if (r < 0.068 + rareBoost) {
    return {
      kind: 'special_night',
      amount: 1,
      label: 'Special night',
      rarity: 'rare',
      flavor: 'Your closest companion — dressed for the evening, just for you.',
    }
  }

  // Uncommon date coin ~18%
  if (r < 0.25 + rareBoost) {
    return {
      kind: 'date_coin',
      amount: 1,
      label: '+1 Date coin',
      rarity: 'uncommon',
      flavor: 'Spend on a night out without touching your gold.',
    }
  }

  // Uncommon token crumb ~12%
  if (r < 0.37) {
    const amount = Number((0.2 + Math.random() * 0.3).toFixed(2))
    return {
      kind: 'token',
      amount,
      label: `+${amount} token`,
      rarity: 'uncommon',
      flavor: 'A thin Consistency Token for showing up.',
    }
  }

  // Common gold
  const gold = 10 + Math.floor(Math.random() * 16) // 10–25
  return {
    kind: 'gold',
    amount: gold,
    label: `+${gold} gold`,
    rarity: 'common',
    flavor: 'The party notices you made it.',
  }
}

export const ANGEL_SLUG = 'aurelia_solace'

export function chicagoYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function yesterdayChicagoYmd(): string {
  const now = new Date()
  // Approximate: subtract 24h then format in Chicago (good enough for streak)
  const y = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return chicagoYmd(y)
}
