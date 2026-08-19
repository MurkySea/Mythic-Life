/**
 * Quest Loot — instant gratification on real task completion.
 * Pure functions. Designed 2026-07-24.
 */

export type LootKind = 'gold' | 'token' | 'affinity' | 'scene_credit' | 'nothing'

export interface LootDrop {
  kind: LootKind
  amount: number
  label: string
  rarity: 'common' | 'uncommon' | 'rare'
}

/** Weighted roll after a quest is completed. */
export function rollQuestLoot(opts?: { streak?: number }): LootDrop {
  const streak = opts?.streak || 0
  // Slightly better odds on a streak
  const boost = streak >= 5 ? 0.08 : streak >= 3 ? 0.04 : 0
  const r = Math.random()

  // ~38% nothing (keeps drops feeling special)
  if (r > 0.62 + boost) {
    return { kind: 'nothing', amount: 0, label: '', rarity: 'common' }
  }

  const r2 = Math.random()

  // Rare scene credit ~4%
  if (r2 < 0.04 + boost * 0.3) {
    return {
      kind: 'scene_credit',
      amount: 1,
      label: 'Scene credit',
      rarity: 'rare',
    }
  }

  // Uncommon token ~12%
  if (r2 < 0.16) {
    const amount = Number((0.15 + Math.random() * 0.25).toFixed(2))
    return {
      kind: 'token',
      amount,
      label: `+${amount} token`,
      rarity: 'uncommon',
    }
  }

  // Affinity crumb ~18%
  if (r2 < 0.34) {
    return {
      kind: 'affinity',
      amount: 1,
      label: '+1 affinity',
      rarity: 'uncommon',
    }
  }

  // Common gold
  const gold = 4 + Math.floor(Math.random() * 10) // 4–13
  return {
    kind: 'gold',
    amount: gold,
    label: `+${gold} gold`,
    rarity: 'common',
  }
}

/** Cost to take a companion on a date (experience, not transaction). */
export const DATE_GOLD_COST = 35

/**
 * Relationship reward for a successful date.
 * Trust / Intimacy are the primary relationship axes; Affinity / Bond XP remain
 * mirrored for legacy scene gates and older UI.
 */
export function dateRewards() {
  return {
    trustDelta: 1.5,
    intimacyDelta: 4,
    affinityDelta: 2,
    bondXpDelta: 55,
    note: 'A shared night out. The memory sticks.',
  }
}

/** Build a tasteful night-out image prompt for a companion. */
export function buildDateScenePrompt(opts: {
  appearance: string
  name: string
  race?: string
}): string {
  const look = opts.appearance.trim()
  const name = opts.name
  const settings = [
    'soft city lights at dusk, elegant restaurant terrace',
    'warm lantern-lit street, evening dress',
    'rooftop overlook, golden hour fading to night',
    'quiet jazz bar booth, candlelight',
    'moonlit garden path after dinner',
  ]
  const outfits = [
    'elegant evening dress, refined jewelry',
    'tailored coat over a soft evening blouse',
    'classic little black dress, graceful',
    'flowing formal dress with subtle detail',
    'smart evening wear, polished but personal',
  ]
  const poses = [
    'standing, slight smile, looking toward the viewer',
    'seated at a small table, soft eye contact',
    'walking pause under streetlight, half-turn',
    'leaning on a balcony rail, relaxed',
  ]

  const seed = name.length * 7 + (opts.race?.length || 3)
  const setting = settings[seed % settings.length]
  const outfit = outfits[(seed + 2) % outfits.length]
  const pose = poses[(seed + 5) % poses.length]

  return [
    'masterpiece illustration of an adult woman, coherent anatomy, beautiful lighting, high detail, no text, no watermark',
    'refined anime key-visual quality, cinematic',
    `Character: ${look}`,
    `Name context: ${name}`,
    `Occasion: a special night out together — dressed up for the evening`,
    `Outfit: ${outfit}`,
    `Pose: ${pose}`,
    `Setting: ${setting}`,
    'expression: warm, present, quietly happy — not performative',
    'romantic atmosphere, elegant, tasteful, fully clothed, soft chemistry',
    'single character focus, clear face, feminine adult proportions',
  ].join('. ')
}
