/** Real-life skill domains — each scales independently */
export const SKILLS = [
  'faith',
  'discipline',
  'fitness',
  'knowledge',
  'relations',
  'business',
  'stewardship',
  'wisdom',
] as const

export type SkillKey = (typeof SKILLS)[number]

export const SKILL_LABELS: Record<SkillKey, string> = {
  faith: 'Faith',
  discipline: 'Discipline',
  fitness: 'Fitness',
  knowledge: 'Knowledge',
  relations: 'Relations',
  business: 'Business',
  stewardship: 'Stewardship',
  wisdom: 'Wisdom',
}

/** XP per completion toward each selected domain */
export const XP_PER_DOMAIN = 12

/** Level from total XP: level 1 at 0, +1 every 50 XP */
export function skillLevelFromXp(xp: number): number {
  return Math.max(1, Math.floor(xp / 50) + 1)
}

export function xpIntoLevel(xp: number): { level: number; into: number; need: number } {
  const level = skillLevelFromXp(xp)
  const floor = (level - 1) * 50
  const into = xp - floor
  return { level, into, need: 50 }
}

export function parseDomains(raw: string | null | undefined, fallback?: string | null): SkillKey[] {
  const fromMulti =
    raw && typeof raw === 'string'
      ? raw
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter((s): s is SkillKey => (SKILLS as readonly string[]).includes(s))
      : []
  if (fromMulti.length > 0) return fromMulti
  if (fallback && (SKILLS as readonly string[]).includes(fallback.toLowerCase())) {
    return [fallback.toLowerCase() as SkillKey]
  }
  return []
}
