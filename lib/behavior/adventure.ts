import type { BehavioralTask, MomentumBand } from './types'

export type AdventureChoice = {
  category: 'Quick Hunt' | 'Dungeon' | 'Side Quest'
  task: BehavioralTask
  reason: string
}

function ageDays(task: BehavioralTask, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(task.createdAt).getTime()) / 86_400_000)
}

function urgent(task: BehavioralTask, now: Date): boolean {
  if (task.mustDo || task.priority >= 8) return true
  if (!task.dueAt) return false
  return new Date(task.dueAt).getTime() <= now.getTime() + 86_400_000
}

export function selectAdventureChoices(input: {
  tasks: BehavioralTask[]
  momentum: MomentumBand
  availableMinutes?: number
  now?: Date
}): AdventureChoice[] {
  const now = input.now ?? new Date()
  let eligible = input.tasks.filter((task) => !task.completedAt)
  if (input.availableMinutes) {
    const withinTime = eligible.filter((task) => task.effortMinutes <= input.availableMinutes!)
    if (withinTime.length >= 3) eligible = withinTime
  }

  const urgentTasks = eligible.filter((task) => urgent(task, now))
  const responsiblePool = urgentTasks.length > 0
    ? eligible.filter((task) => urgent(task, now) || task.priority >= 6)
    : eligible
  const used = new Set<string>()
  const pick = (ranked: BehavioralTask[]) => ranked.find((task) => !used.has(task.id))
  const choose = (
    category: AdventureChoice['category'],
    ranked: BehavioralTask[],
    reason: string,
  ) => {
    const task = pick(ranked)
    if (!task) return null
    used.add(task.id)
    return { category, task, reason }
  }

  const quick = [...responsiblePool].sort((a, b) =>
    a.effortMinutes - b.effortMinutes || b.priority - a.priority)
  const dungeon = [...responsiblePool].sort((a, b) =>
    Number(urgent(b, now)) - Number(urgent(a, now)) ||
    b.priority - a.priority || b.effortMinutes - a.effortMinutes)
  const side = [...responsiblePool].sort((a, b) =>
    ageDays(b, now) - ageDays(a, now) || a.priority - b.priority)

  return [
    choose('Quick Hunt', quick, 'A worthwhile win you can claim quickly.'),
    choose('Dungeon', dungeon, 'The demanding objective most worthy of focused effort.'),
    choose(
      'Side Quest',
      side,
      input.momentum === 'Dormant'
        ? 'A neglected thread that can help the world begin moving again.'
        : 'An older worthwhile thread that deserves fresh attention.',
    ),
  ].filter((choice): choice is AdventureChoice => Boolean(choice))
}
