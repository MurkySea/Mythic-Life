import { describe, expect, it } from 'vitest'
import {
  bossForDate,
  computeHuntPrep,
  resolveHuntTurn,
  type HuntBoss,
} from './hunt'

const duelBoss: HuntBoss = {
  key: 'duel-test',
  name: 'Test Warden',
  title: 'Test',
  maxHp: 70,
  rewardGold: 20,
  pattern: ['slash'],
  description: 'test',
  trophy: 'test',
}

describe('daily Hunt', () => {
  it('chooses the same boss for the same date', () => {
    expect(bossForDate('2026-09-09')).toEqual(bossForDate('2026-09-09'))
  })

  it('turns real completions into bounded prep damage and resolve', () => {
    const light = computeHuntPrep({
      tasks: [{ difficulty: 1 }],
      completedHabits: 0,
      morningDone: false,
      mainQuestDone: false,
    })
    const strong = computeHuntPrep({
      tasks: [
        { difficulty: 4, mustDo: true },
        { difficulty: 3 },
        { difficulty: 2 },
      ],
      completedHabits: 3,
      morningDone: true,
      mainQuestDone: true,
    })

    expect(strong.damage).toBeGreaterThan(light.damage)
    expect(strong.damage).toBeLessThanOrEqual(54)
    expect(strong.resolveEarned).toBeLessThanOrEqual(4)
  })

  it('rewards a perfect parry against a quick slash', () => {
    const result = resolveHuntTurn({
      boss: duelBoss,
      dateKey: '2026-09-09',
      state: { bossHp: 40, playerHp: 5, resolve: 2, turn: 0, status: 'ready' },
      action: 'parry',
      parryQuality: 'perfect',
    })

    expect(result.bossDamage).toBe(18)
    expect(result.playerDamage).toBe(0)
    expect(result.resolve).toBe(1)
    expect(result.status).toBe('active')
  })

  it('refuses a resolve move when the player has no resolve', () => {
    expect(() =>
      resolveHuntTurn({
        boss: duelBoss,
        dateKey: '2026-09-09',
        state: { bossHp: 40, playerHp: 5, resolve: 0, turn: 0, status: 'ready' },
        action: 'dodge',
      })
    ).toThrow('Not enough Resolve')
  })

  it('ends immediately when the boss is reduced to zero', () => {
    const result = resolveHuntTurn({
      boss: duelBoss,
      dateKey: '2026-09-09',
      state: { bossHp: 8, playerHp: 5, resolve: 0, turn: 0, status: 'active' },
      action: 'strike',
    })

    expect(result.bossHp).toBe(0)
    expect(result.status).toBe('victory')
  })
})
