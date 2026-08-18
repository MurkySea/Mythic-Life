import { describe, expect, it } from 'vitest'
import { COMPANION_DEFS } from './companions-v2'
import { characterSheetPrompt, getCharacterSheet, visualCanonPrompt } from './characterSheets'
import { buildCompanionSystemPrompt } from './companionVoice-v2'
import { getCharacterProfile } from './characterStudio-v2'

describe('story character canon', () => {
  it('keeps Elowen and Seraphine as distinct characters', () => {
    const elowen = getCharacterSheet('seraphine')
    const seraphine = getCharacterSheet('seraphine_quietflame')

    expect(elowen?.name).toBe('Elowen')
    expect(seraphine?.name).toBe('Seraphine')
    expect(elowen?.neverContradict.join(' ')).toContain('founding companion')
    expect(seraphine?.neverContradict.join(' ')).toContain('Silver Foxkin')
  })

  it('injects Elowen shared history and Lumenvale canon into live dialogue prompts', () => {
    const def = COMPANION_DEFS.find((companion) => companion.name === 'Elowen')
    expect(def).toBeTruthy()

    const prompt = buildCompanionSystemPrompt({
      def,
      displayName: 'Elowen',
      affinity: 12,
      mood: 'warm',
      memoryBlock: '',
      historyBlock: '',
    })

    expect(prompt).toContain('CANON CHARACTER SHEET')
    expect(prompt).toContain('Lumenvale Academy')
    expect(prompt).toContain('Living Radiance')
    expect(prompt).toContain('young teenagers')
    expect(prompt).toContain('SHARED-HISTORY DISCIPLINE')
    expect(prompt).toContain('Seraphine is a separate Silver Foxkin companion')
  })

  it('gives Elowen an equal-partner Character Studio profile', () => {
    const def = COMPANION_DEFS.find((companion) => companion.name === 'Elowen')
    const profile = getCharacterProfile(def)

    expect(profile.name).toBe('Elowen')
    expect(profile.northStar).toContain('stand beside Mark')
    expect(profile.flirtStyle).toContain('Adult attraction')
    expect(profile.avoidExamples.join(' ')).toContain('saved me')
  })

  it('uses the full visual anchor for generated Elowen imagery', () => {
    const def = COMPANION_DEFS.find((companion) => companion.name === 'Elowen')
    const visual = visualCanonPrompt(def)

    expect(visual).toContain('platinum-silver blonde hair')
    expect(visual).toContain('septum piercing')
    expect(visual).toContain('floral sundress')
    expect(visual).toContain('spectral angelic wings')
    expect(visual).toContain('no animal ears')
  })

  it('renders a separate Seraphine sheet without borrowing Elowen history', () => {
    const def = COMPANION_DEFS.find((companion) => companion.slug === 'seraphine_quietflame')
    const prompt = characterSheetPrompt(def)

    expect(prompt).toContain('Silver Foxkin')
    expect(prompt).toContain('first stretch of road')
    expect(prompt).toContain('Never borrow Elowen’s memories')
    expect(prompt).not.toContain('Mark saved his adventuring earnings for her education')
  })
})
