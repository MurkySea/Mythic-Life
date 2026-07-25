import { describe, it, expect } from 'vitest'
import {
  parseDomains,
  skillLevelFromXp,
  xpIntoLevel,
  XP_PER_DOMAIN,
} from '@/lib/skills'

describe('parseDomains', () => {
  it('parses comma-separated valid domains', () => {
    expect(parseDomains('faith, discipline, fitness')).toEqual([
      'faith',
      'discipline',
      'fitness',
    ])
  })

  it('ignores unknown domains', () => {
    expect(parseDomains('faith, hacking, discipline')).toEqual([
      'faith',
      'discipline',
    ])
  })

  it('falls back to single domain when multi is empty', () => {
    expect(parseDomains('', 'knowledge')).toEqual(['knowledge'])
  })

  it('returns empty array for garbage', () => {
    expect(parseDomains('nope, also-no')).toEqual([])
  })
})

describe('skillLevelFromXp', () => {
  it('starts at level 1', () => {
    expect(skillLevelFromXp(0)).toBe(1)
  })

  it('levels every 50 XP', () => {
    expect(skillLevelFromXp(49)).toBe(1)
    expect(skillLevelFromXp(50)).toBe(2)
    expect(skillLevelFromXp(100)).toBe(3)
  })
})

describe('xpIntoLevel', () => {
  it('reports progress inside the current level', () => {
    const r = xpIntoLevel(62)
    expect(r.level).toBe(2)
    expect(r.into).toBe(12)
    expect(r.need).toBe(50)
  })
})

describe('XP_PER_DOMAIN', () => {
  it('is a positive constant', () => {
    expect(XP_PER_DOMAIN).toBeGreaterThan(0)
  })
})
