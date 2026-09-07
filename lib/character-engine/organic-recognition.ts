import type {
  CharacterAnalysis,
  CharacterState,
  CharacterThought,
} from '@/lib/character-engine/types'

export type HabitRecognitionLog = {
  habitId: string
  title: string
  loggedDate: string
  completed: boolean
}

export type OrganicRecognitionCandidate = {
  id: string
  topic: 'organic_recognition'
  summary: string
  importance: number
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isFinite(date.getTime()) ? date : null
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function ageInDays(todayKey: string, value: string): number | null {
  const today = parseDateKey(todayKey)
  const day = parseDateKey(value)
  if (!today || !day) return null
  return Math.floor((today.getTime() - day.getTime()) / 86_400_000)
}

export function weekKeyForDate(todayKey: string): string {
  const today = parseDateKey(todayKey)
  if (!today) return todayKey
  const weekday = today.getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  today.setUTCDate(today.getUTCDate() - daysSinceMonday)
  return dateKey(today)
}

function topHabitPhrase(counts: Map<string, number>): string {
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)

  if (!ranked.length) return 'his habits'
  return ranked
    .map(([title, count]) => `${title} (${count})`)
    .join(', ')
}

/**
 * Detect a genuinely notable habit stretch against Mark's own recent baseline.
 * This deliberately does not reward an arbitrary target; it asks whether the
 * current seven-day window is meaningfully stronger than the prior three weeks.
 */
export function deriveHabitRecognition(opts: {
  todayKey: string
  logs: HabitRecognitionLog[]
}): OrganicRecognitionCandidate | null {
  const recent: HabitRecognitionLog[] = []
  const prior: HabitRecognitionLog[] = []

  for (const log of opts.logs) {
    if (!log.completed) continue
    const age = ageInDays(opts.todayKey, log.loggedDate)
    if (age == null || age < 0) continue
    if (age <= 6) recent.push(log)
    else if (age <= 27) prior.push(log)
  }

  const recentTotal = recent.length
  const priorWeeklyAverage = prior.length / 3
  const recentCounts = new Map<string, number>()
  const priorCounts = new Map<string, number>()

  for (const log of recent) {
    recentCounts.set(log.title, (recentCounts.get(log.title) ?? 0) + 1)
  }
  for (const log of prior) {
    priorCounts.set(log.title, (priorCounts.get(log.title) ?? 0) + 1)
  }

  const strongOverallWeek =
    recentTotal >= 5 &&
    (prior.length < 3 || recentTotal >= priorWeeklyAverage + 1.75)

  if (strongOverallWeek) {
    const baselineText =
      prior.length >= 3
        ? `That is meaningfully stronger than his recent baseline of about ${priorWeeklyAverage.toFixed(1)} completions per week.`
        : 'There is not much prior habit history yet, but this is still a strong stretch of follow-through.'

    return {
      id: `organic:habit-week:${weekKeyForDate(opts.todayKey)}`,
      topic: 'organic_recognition',
      summary: `He has logged ${recentTotal} habit completions in the last seven days across ${topHabitPhrase(recentCounts)}. ${baselineText} She noticed the consistency without being asked.`,
      importance: Math.min(92, 72 + recentTotal * 2),
    }
  }

  const strongestHabit = [...recentCounts.entries()]
    .map(([title, count]) => ({
      title,
      count,
      priorWeeklyAverage: (priorCounts.get(title) ?? 0) / 3,
    }))
    .filter((item) => item.count >= 4)
    .sort((a, b) => b.count - a.count)[0]

  if (
    strongestHabit &&
    (prior.length < 3 || strongestHabit.count >= strongestHabit.priorWeeklyAverage + 1.5)
  ) {
    return {
      id: `organic:habit:${strongestHabit.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}:${weekKeyForDate(opts.todayKey)}`,
      topic: 'organic_recognition',
      summary: `He has followed through on ${strongestHabit.title} ${strongestHabit.count} times in the last seven days. That consistency is notable for him, and she noticed it without being asked.`,
      importance: Math.min(88, 72 + strongestHabit.count * 3),
    }
  }

  return null
}

export function selectOrganicRecognitionThought(
  state: CharacterState
): CharacterThought | undefined {
  return state.unresolvedThoughts
    .filter((thought) => thought.topic === 'organic_recognition' && !thought.resolvedAt)
    .sort((a, b) => b.importance - a.importance || a.createdAt.localeCompare(b.createdAt))[0]
}

export function canOfferOrganicRecognition(opts: {
  analysis: CharacterAnalysis
  disclosureDepth: number
}): boolean {
  if (opts.analysis.isCorrection || opts.analysis.isVulnerable) return false
  if (opts.disclosureDepth >= 3) return false
  if (opts.analysis.intent === 'venting' || opts.analysis.intent === 'correction') return false
  return true
}
