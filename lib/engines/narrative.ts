/**
 * Layer 1 — Daily Narrative
 *
 * Pure second-person isekai chronicle built from Layer 0 signals.
 * No LLM required. Templates stay short and specific.
 */

import type { PartyMood } from './party-doctrine'
import type { SelfNeglectSeverity } from './types'

export interface NarrativeInput {
  /** Local date YYYY-MM-DD if known */
  date?: string | null
  /** Rhythm tier label (any alias ok) */
  rhythmTier?: string | null
  shadowDebt?: number
  selfNeglect?: SelfNeglectSeverity | string | null
  partyMood?: PartyMood | null
  /** Optional party speaker name for a closing beat */
  speakerName?: string | null
  tokensEarnedToday?: number
  taskCountHint?: number
}

function normalizeTier(tier?: string | null): string {
  switch (tier) {
    case 'Excellent':
    case 'Elite':
      return 'Excellent'
    case 'Good':
    case 'Strong':
      return 'Good'
    case 'Poor':
    case 'Fragile':
      return 'Poor'
    case 'Bad':
    case 'Broken':
      return 'Bad'
    case 'Neutral':
    case 'Steady':
      return 'Neutral'
    default:
      return 'Unknown'
  }
}

function rhythmLine(tier: string): string {
  switch (tier) {
    case 'Excellent':
      return 'The night held. Your vessel returned clean — the kind of rest the road respects.'
    case 'Good':
      return 'You slept enough to carry the day without borrowing against tomorrow.'
    case 'Neutral':
      return 'Rest was ordinary. Not a failure. Not a triumph. The line still holds.'
    case 'Poor':
      return 'The night ran short. You feel it in the edges — and so does anyone who follows you.'
    case 'Bad':
      return 'The night broke. Shadow notices when the leader does not return whole.'
    default:
      return 'No clear reading on the night. The party waits for a true signal.'
  }
}

function debtLine(debt: number): string {
  if (debt <= 0) return 'No shadow debt sits on the ledger.'
  if (debt < 3) return 'A thin thread of shadow debt remains — present, not yet heavy.'
  if (debt < 8) return 'Shadow debt has weight. The party feels the drag even when you do not name it.'
  if (debt < 15) return 'Debt presses. Respect thins when the cost of neglect stays unpaid.'
  return 'Shadow debt is thick. The world does not forgive what the body and the will postpone forever.'
}

function neglectLine(sev?: string | null): string | null {
  switch (sev) {
    case 'mild':
      return 'Self was slightly underfed. The vessel still answered; it should not be asked to forever.'
    case 'moderate':
      return 'Self was neglected. Work and duty ate the margin that keeps a leader human.'
    case 'severe':
      return 'Self was starved. A leader who only serves outward will eventually have nothing left to lead with.'
    default:
      return null
  }
}

function moodLine(mood?: PartyMood | null, speakerName?: string | null): string | null {
  if (!mood) return null
  const who = speakerName || 'Someone who follows you'
  switch (mood) {
    case 'proud':
      return `${who} does not cheer. She simply stays closer — the quiet kind of respect.`
    case 'steady':
      return `The party remains. Ordinary faithfulness is still faithfulness.`
    case 'uneasy':
      return `${who} noticed the slip. Not a lecture — a watchful presence.`
    case 'strained':
      return `${who} is still here. Trust is thinner; honesty is the only repair.`
    case 'fractured':
      return `${who} will not pretend the day was fine. Respect requires the truth — and she has not left.`
    default:
      return null
  }
}

function effortLine(taskCount?: number, tokens?: number): string | null {
  if (taskCount != null && taskCount >= 6) {
    return 'You moved real weight today. The chronicle records the work.'
  }
  if (taskCount != null && taskCount >= 3) {
    return 'Enough was done to keep the road from going cold.'
  }
  if (taskCount != null && taskCount === 0) {
    return 'Little was marked complete. Quiet days are allowed — they are not free of consequence.'
  }
  if (tokens != null && tokens > 0) {
    return 'Consistency left a mark. Tokens do not lie about who returned.'
  }
  return null
}

/**
 * Build a short second-person daily chronicle.
 * Always returns at least one paragraph.
 */
export function buildDailyChronicle(input: NarrativeInput): string {
  const tier = normalizeTier(input.rhythmTier)
  const parts: string[] = []

  parts.push(rhythmLine(tier))
  parts.push(debtLine(input.shadowDebt ?? 0))

  const neglect = neglectLine(input.selfNeglect)
  if (neglect) parts.push(neglect)

  const effort = effortLine(input.taskCountHint, input.tokensEarnedToday)
  if (effort) parts.push(effort)

  const mood = moodLine(input.partyMood, input.speakerName)
  if (mood) parts.push(mood)

  // Closing beat — keeps isekai tone without speechifying
  if (tier === 'Excellent' || tier === 'Good') {
    parts.push('The other world remains open because you kept the vessel.')
  } else if (tier === 'Bad' || tier === 'Poor') {
    parts.push('Return. The party follows a leader who comes back.')
  } else {
    parts.push('The road is still under your feet.')
  }

  return parts.join(' ')
}

/** One-line status for compact UI */
export function buildDailyHeadline(input: NarrativeInput): string {
  const tier = normalizeTier(input.rhythmTier)
  const debt = input.shadowDebt ?? 0
  if (tier === 'Excellent') return 'The night held. The road respects you.'
  if (tier === 'Good') return 'Rest was enough. The line holds.'
  if (tier === 'Bad' || (debt >= 10 && tier === 'Poor')) {
    return 'Shadow is loud. Return whole.'
  }
  if (tier === 'Poor') return 'The night ran short. The party noticed.'
  if (debt >= 5) return 'Debt has weight. Honesty is the repair.'
  return 'Ordinary faithfulness. Still the road.'
}
