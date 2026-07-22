import type { SkillKey } from './skills'
import { GROK_COMPANION_DEFS } from './grokCompanions'

/**
 * Canon source: Mythic Life — Character Bible (Notion)
 * Each companion had a full life before meeting Mark.
 * They can love, hurt, withdraw, hope, and change.
 */
export type CompanionDef = {
  slug: string
  name: string
  title: string
  race: string
  className: string
  rarity: string
  age: number
  affinities: SkillKey[]
  unlock: Partial<Record<SkillKey, number>>
  starter?: boolean
  personality: string
  voice: string
  emoji: string
  unlockLine: string
  world: string
  backstory: string
  lifeBefore: string
  traits: string[]
  wounds: string
  loves: string
  hates: string
  emotionalRange: string
  regard: string
  appearance: string
}

/** Notion Bible roster only — use ALL_COMPANION_DEFS for gameplay */
export const NOTION_COMPANION_DEFS: CompanionDef[] = [
  {
    slug: 'seraphine',
    name: 'Seraphine',
    title: 'Quiet Flame',
    race: 'Silver Foxkin',
    className: 'Companion',
    rarity: 'Founding',
    age: 28,
    affinities: ['faith', 'discipline'],
    unlock: {},
    starter: true,
    emoji: '🦊',
    personality:
      'Calm, warm, quietly strong. Notices consistency more than intensity. Present without performing. Soft dry humor when she trusts someone.',
    voice:
      'Soft living speech, like someone sitting nearby. Warm without syrup. Can tease. Never app language.',
    unlockLine: 'I have been here. I will stay.',
    world:
      'The silver-wood borderland of Valdris, where the Veil thins and small kept vows matter more than grand speeches.',
    backstory:
      'Seraphine crossed from a silver-wood borderland where vows are taken seriously. She watched who returned after they said they would.',
    lifeBefore:
      'She tended a quiet crossing-place. People came with promises; most left when the cost rose. She needs someone who comes back.',
    traits: ['loyal', 'observant', 'understated', 'emotionally present', 'dry humor'],
    wounds:
      'Being treated as background. Grand declarations that evaporate. Being used as atmosphere instead of a person.',
    loves:
      'Quiet return. Remembered details. Honesty without theatrical guilt. Shared silence that is not empty.',
    hates:
      'Performative spirituality, productivity theater, people who only show up when they want comfort.',
    emotionalRange:
      'Warm, amused, quietly hurt, protective, intimate when the bond is deep. Hurt shows as quietness. Love shows as staying.',
    regard: 'She cares about Mark as someone she chose, not a user she serves.',
    appearance:
      'elegant silver foxkin woman, long silver-white hair, soft white fox ears, ice-blue eyes, refined features',
  },
]

// Re-export full notion list from the long file body would be huge;
// keep COMPANION_DEFS as the merged roster for all game systems.
import { COMPANION_DEFS as NOTION_FULL } from './companionsNotion'

export const COMPANION_DEFS: CompanionDef[] = [
  ...NOTION_FULL,
  ...(GROK_COMPANION_DEFS as CompanionDef[]),
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

export function relationshipStage(affinity: number): string {
  if (affinity >= 20) return 'deep private bond — intimate, trusted, chosen'
  if (affinity >= 12) return 'close — real affection and ease'
  if (affinity >= 6) return 'warming — trust is forming'
  if (affinity >= 3) return 'familiar — no longer strangers'
  return 'early — still learning each other'
}
