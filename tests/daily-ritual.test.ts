import { describe, expect, it } from 'vitest'
import {
  buildMorningCompanionSeed,
  buildMorningUserMessage,
  chicagoDateKey,
  chicagoHour,
} from '@/lib/daily-ritual'

const input = {
  mainQuestTitle: 'Finish the client plan',
  intention: 'Protect the first focused hour.',
  resistance: 'Checking messages instead of starting.',
  identity: 'Calm, deliberate, and present.',
}

describe('daily ritual', () => {
  it('uses Chicago as the day boundary', () => {
    const eveningUtc = new Date('2026-09-09T01:00:00.000Z')
    expect(chicagoDateKey(eveningUtc)).toBe('2026-09-08')
    expect(chicagoHour(eveningUtc)).toBe(20)
  })

  it('turns the morning answers into a natural conversation message', () => {
    const message = buildMorningUserMessage(input)
    expect(message).toContain('Main quest: Finish the client plan.')
    expect(message).toContain('What matters today: Protect the first focused hour.')
    expect(message).toContain('Likely resistance: Checking messages instead of starting.')
    expect(message).toContain('How I want to show up: Calm, deliberate, and present.')
  })

  it('keeps the companion response focused on direction instead of gamified pressure', () => {
    const seed = buildMorningCompanionSeed(input, null)
    expect(seed).toContain('morning ritual')
    expect(seed).toContain('roughly 2-4 sentences')
    expect(seed).toContain('Do not mention a score, streak')
  })
})
