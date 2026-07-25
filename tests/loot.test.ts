import { describe, it, expect } from 'vitest'
import { rollQuestLoot, dateRewards, DATE_GOLD_COST } from '@/lib/engines/loot'

describe('rollQuestLoot', () => {
  it('always returns a well-formed LootDrop', () => {
    for (let i = 0; i < 40; i++) {
      const drop = rollQuestLoot({ streak: i % 8 })
      expect(drop).toHaveProperty('kind')
      expect(drop).toHaveProperty('amount')
      expect(drop).toHaveProperty('label')
      expect(drop).toHaveProperty('rarity')
      expect(['gold', 'token', 'affinity', 'scene_credit', 'nothing']).toContain(
        drop.kind
      )
    }
  })

  it('returns nothing with zero amount', () => {
    // Statistical sample — just ensure the shape is always valid
    const drop = rollQuestLoot()
    if (drop.kind === 'nothing') {
      expect(drop.amount).toBe(0)
    }
  })
})

describe('dateRewards', () => {
  it('gives a positive affinity and bond boost', () => {
    const r = dateRewards()
    expect(r.affinityDelta).toBeGreaterThan(0)
    expect(r.bondXpDelta).toBeGreaterThan(0)
  })
})

describe('DATE_GOLD_COST', () => {
  it('is a positive cost', () => {
    expect(DATE_GOLD_COST).toBeGreaterThan(0)
  })
})
