import { parseCampfireDigest, type CampfireDigest } from '@/lib/campfire-director'

export type MorningRitualInput = {
  mainQuestTitle?: string | null
  intention: string
  resistance: string
  identity: string
}

type SystemMessage = {
  content?: string | null
  created_at?: string | null
}

export function chicagoDateKey(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

export function chicagoHour(value: Date | string = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(value instanceof Date ? value : new Date(value))
  )
}

export function latestCampfireDigest(
  messages: SystemMessage[],
  beforeDate?: string
): CampfireDigest | null {
  const digests = messages
    .map((message) => parseCampfireDigest(message.content))
    .filter((digest): digest is CampfireDigest => Boolean(digest))
    .filter((digest) => !beforeDate || digest.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))

  return digests[0] || null
}

export function campfireDigestForDate(
  messages: SystemMessage[],
  date: string
): CampfireDigest | null {
  for (const message of messages) {
    const digest = parseCampfireDigest(message.content)
    if (digest?.date === date) return digest
  }
  return null
}

export function buildMorningUserMessage(input: MorningRitualInput): string {
  const quest = input.mainQuestTitle?.trim()
    ? `Main quest: ${input.mainQuestTitle.trim()}. `
    : ''

  return `Morning check-in. ${quest}What matters today: ${input.intention.trim()} Likely resistance: ${input.resistance.trim()} How I want to show up: ${input.identity.trim()}`
}

export function buildMorningCompanionSeed(
  input: MorningRitualInput,
  previousCampfire: CampfireDigest | null
): string {
  const quest = input.mainQuestTitle?.trim() || 'No single task was chosen as the main quest.'
  const carried = previousCampfire
    ? `The most recent evening Campfire was "${previousCampfire.headline}."${previousCampfire.carryForward ? ` One unfinished thread was: ${previousCampfire.carryForward}` : ''}`
    : 'There is no recent evening Campfire to carry forward.'

  return `This is Mark's morning ritual, not a task-completion celebration.
Main quest: ${quest}
What matters today: ${input.intention.trim()}
Likely resistance: ${input.resistance.trim()}
How he wants to show up: ${input.identity.trim()}
${carried}

Respond naturally in your own established voice. Help him enter the day with direction, not a productivity lecture. You may connect one genuinely relevant detail from the prior Campfire, but do not force it. Keep it brief: roughly 2-4 sentences. Do not mention a score, streak, ritual system, digest, prompt, or app mechanics.`
}
