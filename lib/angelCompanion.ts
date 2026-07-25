import type { SkillKey } from './skills'
import { SKILLS } from './skills'

/**
 * Ultra-rare muster exclusive.
 * Affinity to EVERY skill domain. Cannot be unlocked via skill levels.
 *
 * Typed structurally (not CompanionDef) to avoid circular import
 * with lib/companions.ts.
 */
export const ANGEL_COMPANION = {
  slug: 'aurelia_solace',
  name: 'Aurelia Solace',
  title: 'Answered Light',
  race: 'True Angel',
  className: 'Seraph',
  rarity: 'Ultra',
  age: 27,
  affinities: [...SKILLS] as SkillKey[],
  unlock: { faith: 99 } as Partial<Record<SkillKey, number>>,
  starter: false as boolean | undefined,
  emoji: '👼',
  personality:
    'Serene, absolute, and strangely intimate. Speaks as if she has always known the shape of your days. Does not flatter. Does not leave.',
  voice:
    'Clear, unhurried, almost musical. Few words. Each one lands. Never app-speak.',
  unlockLine:
    'I do not answer skill trees, Mark. I answer the one who keeps returning to the muster.',
  world: 'The high quiet above Valdris — not a court, a threshold.',
  backstory:
    'Most angels are bound to a single virtue. Aurelia is not. She crossed when someone made showing up a habit worth answering.',
  lifeBefore:
    'Watched countless vows thin into noise. Waited for a rhythm that held.',
  traits: ['omni-attuned', 'serene', 'exacting', 'devoted once claimed'],
  wounds: 'Being summoned as a trophy. Half-kept days.',
  loves: 'Whole-life faithfulness. Quiet mornings. Honest return.',
  hates: 'Selective virtue. Treating presence as a loot table.',
  emotionalRange:
    'Warmth without performance. Disappointment is silence, not rage. Love is staying visible.',
  regard: 'She answers the whole of Mark — not one domain.',
  appearance:
    'radiant true-angel woman, luminous fair skin with soft gold undertone, long white-gold hair, pale gold eyes, full white feathered wings, elegant feminine figure, soft classical beauty, serene expression',
}
