/**
 * Consistency Token sinks
 * Tokens are extras only — never required for main story, tasks, or companions.
 */

export type TokenSinkId =
  | 'companion_gift'
  | 'journal_unlock'
  | 'cosmetic_frame'
  | 'debt_relief'

export interface TokenSink {
  id: TokenSinkId
  label: string
  blurb: string
  cost: number
}

export const TOKEN_SINKS: TokenSink[] = [
  {
    id: 'companion_gift',
    label: 'Companion gift',
    blurb: 'A small token of attention. Purely extra.',
    cost: 2,
  },
  {
    id: 'journal_unlock',
    label: 'Journal flourish',
    blurb: 'Unlock a richer reflection prompt. Optional.',
    cost: 3,
  },
  {
    id: 'cosmetic_frame',
    label: 'Portrait frame',
    blurb: 'Cosmetic only. Never affects stats.',
    cost: 5,
  },
  {
    id: 'debt_relief',
    label: 'Shadow relief',
    blurb: 'Burn tokens to shave a little debt. Still optional.',
    cost: 4,
  },
]

export function getSink(id: string): TokenSink | undefined {
  return TOKEN_SINKS.find((s) => s.id === id)
}
