import type { SkillKey } from './skills'

export type CompanionDef = {
  slug: string
  name: string
  title: string
  race: string
  className: string
  rarity: string
  /** Domains this companion cares about most */
  affinities: SkillKey[]
  /** All listed skills must meet min level to unlock (AND) */
  unlock: Partial<Record<SkillKey, number>>
  /** Always available at start */
  starter?: boolean
  personality: string
  emoji: string
}

/**
 * Milestone unlock model (from Character Bible + design choice).
 * Starter companions begin unlocked; others require skill levels.
 */
export const COMPANION_DEFS: CompanionDef[] = [
  {
    slug: 'seraphine',
    name: 'Seraphine',
    title: 'Quiet Flame',
    race: 'Silver Foxkin',
    className: 'Companion',
    rarity: 'Founding',
    affinities: ['faith', 'discipline'],
    unlock: {},
    starter: true,
    emoji: '🦊',
    personality:
      'Calm, warm, and quietly strong. Values faithfulness, integrity, and small daily obedience. Notices consistency more than intensity.',
  },
  {
    slug: 'kira_foxveil',
    name: 'Kira Foxveil',
    title: 'Veiled Promise',
    race: 'Red Fox Foxkin',
    className: 'Enchantress',
    rarity: 'Legendary',
    affinities: ['faith', 'discipline', 'relations'],
    unlock: { faith: 3, discipline: 2 },
    emoji: '✨',
    personality:
      'Warm, believing, and devoted to others. Encourages Mark to keep promises — including to himself.',
  },
  {
    slug: 'ember_crimsonfall',
    name: 'Ember Crimsonfall',
    title: 'Oath of Flame',
    race: 'Fire Dragonkin',
    className: 'Berserker',
    rarity: 'SSR',
    affinities: ['fitness', 'discipline'],
    unlock: { fitness: 3 },
    emoji: '🔥',
    personality:
      'Fierce, direct, and competitive. Treats hard days as proof of character. Respects physical courage and grit.',
  },
  {
    slug: 'nyx_voidbane',
    name: 'Nyx Voidbane',
    title: 'Star-Veil Oracle',
    race: 'Shadow Fairy',
    className: 'Oracle',
    rarity: 'Legendary',
    affinities: ['faith', 'knowledge'],
    unlock: { faith: 4, knowledge: 2 },
    emoji: '🌙',
    personality:
      'Quiet, otherworldly, and perceptive. Speaks in soft truths. Drawn to study, prayer, and hidden patterns.',
  },
  {
    slug: 'mira_quillweave',
    name: 'Mira Quillweave',
    title: 'Index Keeper',
    race: 'High Elf',
    className: 'Mage',
    rarity: 'Epic',
    affinities: ['knowledge', 'business'],
    unlock: { knowledge: 3 },
    emoji: '📚',
    personality:
      'Precise, curious, and principled about truth. Values learning, planning, and careful work.',
  },
  {
    slug: 'lyra_dawnforge',
    name: 'Lyra Dawnforge',
    title: 'Exiled Guardian',
    race: 'Guardian Angel',
    className: 'Paladin',
    rarity: 'SSR',
    affinities: ['faith', 'relations'],
    unlock: { faith: 3, relations: 2 },
    emoji: '🛡️',
    personality:
      'Protective, earnest, and steady. Cares about people under her watch and sacred commitments.',
  },
  {
    slug: 'kael_ashrunner',
    name: 'Kael Ashrunner',
    title: 'Grey Path',
    race: 'Grey Wolfkin',
    className: 'Ranger',
    rarity: 'Rare',
    affinities: ['fitness', 'discipline'],
    unlock: { fitness: 2, discipline: 2 },
    emoji: '🐺',
    personality:
      'Reserved outdoorsman. Respects endurance, tracking goals, and showing up when it is hard.',
  },
  {
    slug: 'selene_tideglass',
    name: 'Selene Tideglass',
    title: 'Keeper of Returning',
    race: 'Deep-Sea Mermaid',
    className: 'Priestess',
    rarity: 'SSR',
    affinities: ['faith', 'relations', 'knowledge'],
    unlock: { faith: 3, relations: 3 },
    emoji: '🌊',
    personality:
      'Gentle, reflective, and restorative. Helps with recovery after broken streaks and emotional tides.',
  },
]

export function getCompanionDef(slug: string): CompanionDef | undefined {
  return COMPANION_DEFS.find((c) => c.slug === slug)
}

export function meetsUnlock(
  unlock: Partial<Record<SkillKey, number>>,
  levels: Record<string, number>
): boolean {
  const entries = Object.entries(unlock)
  if (entries.length === 0) return true
  return entries.every(([skill, min]) => (levels[skill] || 1) >= (min || 1))
}
