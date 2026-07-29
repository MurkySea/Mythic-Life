import { describe, expect, it } from 'vitest'
import { analyzeCharacterMessage } from '@/lib/character-engine/analysis'
import { scoreMemoryCandidate, shouldPersistMemory } from '@/lib/character-engine/memory'

describe('companion memory scoring', () => {
  it('does not save ordinary small talk', () => {
    const text = 'Hey, how are you?'
    const candidate = scoreMemoryCandidate({
      userText: text,
      analysis: analyzeCharacterMessage(text),
    })

    expect(candidate).toBeNull()
  })

  it('recognizes a durable preference', () => {
    const text = 'My favorite piano piece is River Flows in You.'
    const candidate = scoreMemoryCandidate({
      userText: text,
      analysis: analyzeCharacterMessage(text),
    })

    expect(candidate?.kind).toBe('preference')
    expect(shouldPersistMemory(candidate)).toBe(true)
  })

  it('gives explicit remember requests priority', () => {
    const text = 'Remember this: I want to wake up at 5:30 every weekday.'
    const candidate = scoreMemoryCandidate({
      userText: text,
      analysis: analyzeCharacterMessage(text),
    })

    expect(candidate).not.toBeNull()
    expect(candidate?.importance).toBeGreaterThanOrEqual(80)
    expect(shouldPersistMemory(candidate)).toBe(true)
  })

  it('treats vulnerable disclosures as meaningful without maxing the score', () => {
    const text = "I'm afraid people only value me when I am useful."
    const candidate = scoreMemoryCandidate({
      userText: text,
      analysis: analyzeCharacterMessage(text),
    })

    expect(candidate?.kind).toBe('vulnerability')
    expect(candidate?.importance).toBeGreaterThanOrEqual(70)
    expect(candidate?.importance).toBeLessThan(100)
  })
})
