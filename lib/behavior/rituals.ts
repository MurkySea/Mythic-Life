export type RitualStep = {
  taskId: string
  position: number
  completedAt?: string | null
}

export function ritualChainProgress(steps: RitualStep[]) {
  const ordered = [...steps].sort((a, b) => a.position - b.position)
  const completed = ordered.filter((step) => Boolean(step.completedAt))
  const firstIncomplete = ordered.find((step) => !step.completedAt) ?? null
  return {
    completed: completed.length,
    total: ordered.length,
    isComplete: ordered.length > 0 && completed.length === ordered.length,
    nextTaskId: firstIncomplete?.taskId ?? null,
  }
}

export function isWithinFlexibleWindow(input: {
  completedAt: Date
  earliestHour?: number
  latestHour?: number
}): boolean {
  if (input.earliestHour == null || input.latestHour == null) return true
  const hour = input.completedAt.getHours()
  if (input.earliestHour <= input.latestHour) {
    return hour >= input.earliestHour && hour <= input.latestHour
  }
  return hour >= input.earliestHour || hour <= input.latestHour
}
