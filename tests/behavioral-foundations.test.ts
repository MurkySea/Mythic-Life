import { describe, expect, it } from 'vitest'
import { selectAdventureChoices } from '@/lib/behavior/adventure'
import { selectWorldEvent } from '@/lib/behavior/events'
import { advanceMomentum } from '@/lib/behavior/momentum'
import { calculateCompletionReward } from '@/lib/behavior/rewards'
import { isWithinFlexibleWindow, ritualChainProgress } from '@/lib/behavior/rituals'
import { detectBehavioralSignals } from '@/lib/behavior/signals'
import type { BehavioralTask } from '@/lib/behavior/types'

const now = new Date('2026-08-07T15:00:00.000Z')

function task(overrides: Partial<BehavioralTask>): BehavioralTask {
  return {
    id: 'task-1',
    title: 'Default task',
    activityKind: 'quest',
    domainKeys: ['home'],
    priority: 5,
    effortMinutes: 30,
    createdAt: '2026-08-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('ritual foundations', () => {
  it('tracks ordered chains by sequence rather than exact clock time', () => {
    expect(ritualChainProgress([
      { taskId: 'coffee', position: 1 },
      { taskId: 'wake', position: 0, completedAt: now.toISOString() },
    ])).toMatchObject({ completed: 1, total: 2, nextTaskId: 'coffee' })
  })

  it('supports optional flexible and overnight windows', () => {
    expect(isWithinFlexibleWindow({ completedAt: now })).toBe(true)
    expect(isWithinFlexibleWindow({ completedAt: new Date('2026-08-07T23:00:00'), earliestHour: 20, latestHour: 2 })).toBe(true)
  })
})

describe('momentum and completion rewards', () => {
  it('softly decays after misses and strongly rewards returning', () => {
    const result = advanceMomentum(
      { score: 40, band: 'Building', lastActionAt: '2026-08-04T15:00:00.000Z' },
      now,
    )
    expect(result.score).toBe(52)
    expect(result.band).toBe('Momentum')
  })

  it('makes final quest completion materially more valuable than progress', () => {
    const progress = calculateCompletionReward({ activityKind: 'quest', effortMinutes: 90, isFinalCompletion: false })
    const complete = calculateCompletionReward({ activityKind: 'quest', effortMinutes: 90, isFinalCompletion: true })
    expect(complete.xp).toBeGreaterThan(progress.xp * 4)
    expect(complete.gold).toBeGreaterThan(0)
  })
})

describe('controlled novelty', () => {
  it('honors event cooldowns and prevents recent repetition', () => {
    expect(selectWorldEvent({
      recentEvents: [{ kind: 'chest', occurredAt: '2026-08-07T12:00:00.000Z' }],
      now,
      random: () => 0,
    })).toBeNull()

    const rolls = [0, 0]
    expect(selectWorldEvent({
      recentEvents: [{ kind: 'chest', occurredAt: '2026-08-05T12:00:00.000Z' }],
      now,
      random: () => rolls.shift() ?? 0,
    })).not.toBe('chest')
  })
})

describe('Give Me an Adventure', () => {
  it('returns distinct quick, difficult, and neglected choices', () => {
    const choices = selectAdventureChoices({
      momentum: 'Building',
      now,
      tasks: [
        task({ id: 'quick', title: 'Send form', effortMinutes: 10, priority: 7 }),
        task({ id: 'hard', title: 'Finish report', effortMinutes: 150, priority: 9 }),
        task({ id: 'old', title: 'Repair shelf', createdAt: '2026-07-01T12:00:00.000Z', priority: 6 }),
      ],
    })
    expect(choices.map((choice) => choice.category)).toEqual(['Quick Hunt', 'Dungeon', 'Side Quest'])
    expect(new Set(choices.map((choice) => choice.task.id)).size).toBe(3)
  })

  it('does not surface irresponsible low-priority choices over urgent work', () => {
    const choices = selectAdventureChoices({
      momentum: 'Flow',
      now,
      tasks: [
        task({ id: 'urgent', title: 'Submit taxes', priority: 10, dueAt: now.toISOString() }),
        task({ id: 'worthy', title: 'Pay invoice', priority: 7 }),
        task({ id: 'novel', title: 'Repaint miniature', priority: 2 }),
      ],
    })
    expect(choices.some((choice) => choice.task.id === 'novel')).toBe(false)
    expect(choices.some((choice) => choice.task.id === 'urgent')).toBe(true)
  })
})

describe('behavioral signals', () => {
  it('detects completion, proliferation, and avoidance without diagnosing', () => {
    const tasks = [
      task({ id: 'win', title: 'Hard win', effortMinutes: 120, completedAt: '2026-08-06T12:00:00.000Z' }),
      task({ id: 'avoided', title: 'Submit paperwork', priority: 9, createdAt: '2026-07-01T12:00:00.000Z' }),
      ...Array.from({ length: 9 }, (_, index) => task({ id: `open-${index}`, title: `Open ${index}` })),
    ]
    const signals = detectBehavioralSignals(tasks, now)
    expect(signals.map((signal) => signal.kind)).toEqual(expect.arrayContaining([
      'completion_worthy',
      'quest_proliferation',
      'task_avoidance',
    ]))
  })
})
