import { COMPANION_DEFS as NOTION_DEFS, type CompanionDef } from './companions'
import { GROK_COMPANION_DEFS } from './grokCompanions'

/** Full playable roster: Notion Bible + original Grok cast */
export const ALL_COMPANION_DEFS: CompanionDef[] = [
  ...NOTION_DEFS,
  ...(GROK_COMPANION_DEFS as CompanionDef[]),
]

export function getAnyCompanionDef(slug: string): CompanionDef | undefined {
  return ALL_COMPANION_DEFS.find((c) => c.slug === slug)
}

export { meetsUnlock, relationshipStage } from './companions'
export type { CompanionDef } from './companions'
