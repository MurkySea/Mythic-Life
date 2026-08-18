import { describe, expect, it } from 'vitest'
import { getCompanionDef } from './companions-v2'
import { buildScenePrompt } from './scenes-v2'

describe('canon-aware scene prompts', () => {
  it('uses Elowen visual canon for the legacy starter key without foxkin leakage', () => {
    const elowen = getCompanionDef('seraphine')
    expect(elowen?.name).toBe('Elowen')

    const prompt = buildScenePrompt(12, elowen, 0)
    const lower = prompt.toLowerCase()

    expect(lower).toContain('platinum-silver blonde hair')
    expect(lower).toContain('septum piercing')
    expect(lower).toContain('no animal ears')
    expect(lower).not.toContain('subtle fox-ear expression')
    expect(lower).not.toContain('tail curled with mood')
    expect(lower).not.toContain('soft fur catching light')
    expect(lower).not.toContain('one ear tilted, attentive')
  })

  it('resolves a missing scene definition to the canonical founding companion', () => {
    const prompt = buildScenePrompt(12, null, 1).toLowerCase()

    expect(prompt).toContain('platinum-silver blonde hair')
    expect(prompt).not.toContain('elegant silver foxkin woman')
  })

  it('keeps actual Seraphine foxkin when she is the selected companion', () => {
    const seraphine = getCompanionDef('seraphine_quietflame')
    expect(seraphine?.name).toBe('Seraphine')

    const prompt = buildScenePrompt(6, seraphine, 0).toLowerCase()
    expect(prompt).toMatch(/foxkin|fox ears|fox-ear/)
  })
})
