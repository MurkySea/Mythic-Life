import type { BehavioralTask } from './types'

export type BehavioralSignalKind =
  | 'completion_worthy'
  | 'quest_proliferation'
  | 'priority_bouncing'
  | 'task_avoidance'
  | 'domain_neglect'

export type BehavioralSignal = {
  kind: BehavioralSignalKind
  strength: number
  evidence: string
}

export function detectBehavioralSignals(
  tasks: BehavioralTask[],
  now: Date = new Date(),
): BehavioralSignal[] {
  const signals: BehavioralSignal[] = []
  const open = tasks.filter((task) => !task.completedAt)
  const recentCompleted = tasks.filter((task) => {
    if (!task.completedAt) return false
    return now.getTime() - new Date(task.completedAt).getTime() <= 7 * 86_400_000
  })

  const difficultWins = recentCompleted.filter((task) => task.effortMinutes >= 90)
  if (difficultWins.length > 0) {
    signals.push({
      kind: 'completion_worthy',
      strength: Math.min(1, 0.6 + difficultWins.length * 0.1),
      evidence: `Completed ${difficultWins.length} difficult objective${difficultWins.length === 1 ? '' : 's'} this week.`,
    })
  }
  if (open.filter((task) => task.activityKind === 'quest').length >= 10 && recentCompleted.length <= 2) {
    signals.push({
      kind: 'quest_proliferation',
      strength: 0.8,
      evidence: 'Many quests are open while very few have recently been finished.',
    })
  }

  const oldHighPriority = open.find((task) =>
    task.priority >= 7 && now.getTime() - new Date(task.createdAt).getTime() >= 7 * 86_400_000)
  if (oldHighPriority) {
    signals.push({
      kind: 'task_avoidance',
      strength: 0.75,
      evidence: `The high-priority objective “${oldHighPriority.title}” has remained open for at least a week.`,
    })
  }
  return signals
}

export function companionSignalGuidance(signals: BehavioralSignal[]): string {
  if (signals.length === 0) return '(No strong behavioral pattern is supported by current evidence.)'
  return signals
    .map((signal) => `- ${signal.kind}: ${signal.evidence} Treat this as evidence, not a diagnosis.`)
    .join('\n')
}
