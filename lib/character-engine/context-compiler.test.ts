import { describe, expect, it } from 'vitest'
import {
  compileCompanionContext,
  selectRelevantContextLines,
} from '@/lib/character-engine/context-compiler'

describe('companion context compiler', () => {
  it('lets the current topic pull relevant memory into a bounded context', () => {
    const lines = [
      'He likes fishing at the river.',
      'Faith is a real anchor for him.',
      'He has talked about wanting land and a homestead.',
      'He struggles with consistency around workouts.',
      'He enjoys difficult action RPGs.',
      'He values being useful to people.',
      'He likes salty snacks.',
      'He has been learning piano.',
    ]

    const selected = selectRelevantContextLines({
      currentUserText: 'I finally got my workout in tonight. Consistency has been hard lately.',
      lines,
      limit: 3,
    })

    expect(selected).toContain('He struggles with consistency around workouts.')
    expect(selected).toHaveLength(3)
  })

  it('keeps only the recent thread instead of dumping the entire conversation', () => {
    const thread = Array.from({ length: 22 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('companion' as const),
      content: `turn-${index + 1}`,
    }))

    const compiled = compileCompanionContext({
      displayName: 'Elowen',
      currentUserText: 'turn-22',
      thread,
      memoryLines: [],
      knowledgeLines: [],
    })

    expect(compiled.historyBlock).not.toContain('turn-1')
    expect(compiled.historyBlock).toContain('turn-7')
    expect(compiled.historyBlock).toContain('turn-22')
  })

  it('does not manufacture task-count observations outside Character State', () => {
    const compiled = compileCompanionContext({
      displayName: 'Elowen',
      currentUserText: 'Hey',
      thread: [],
      memoryLines: [],
      knowledgeLines: [],
      privateFocus: 'She wonders what he does when nobody needs anything from him.',
    })

    expect(compiled.observationBlock).toContain('persistent Character State')
    expect(compiled.observationBlock).not.toMatch(/completed|streak|four|eight/i)
  })
})
