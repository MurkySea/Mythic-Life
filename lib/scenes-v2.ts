import type { CompanionDef } from '@/lib/companions'
import { getCompanionDef } from '@/lib/companions'
import { visualCanonPrompt } from './characterSheets'
import {
  buildScenePrompt as baseBuildScenePrompt,
  getIntimacyLabel,
  nextSceneMilestone,
  SCENE_MILESTONES,
  sceneTier,
  scenesEarned,
} from './scenes'

export { getIntimacyLabel, nextSceneMilestone, SCENE_MILESTONES, sceneTier, scenesEarned }

function canonSafeDef(def?: CompanionDef | null): CompanionDef | null {
  const resolved = def || getCompanionDef('seraphine') || null
  if (!resolved) return null

  const visualCanon = visualCanonPrompt(resolved)
  const isLegacyStarterKey = resolved.slug === 'seraphine'
  const isActuallyFoxkin = (resolved.race || '').toLowerCase().includes('fox')

  return {
    ...resolved,
    // The founding companion still uses the legacy internal key `seraphine`.
    // The old scene engine interprets that literal slug as foxkin, so give
    // Elowen a neutral runtime slug while composing visual flavor.
    slug: isLegacyStarterKey && !isActuallyFoxkin ? 'elowen' : resolved.slug,
    appearance: visualCanon || resolved.appearance,
  }
}

export function buildScenePrompt(
  affinity: number,
  def?: CompanionDef | null,
  sceneIndex = 0
): string {
  return baseBuildScenePrompt(affinity, canonSafeDef(def), sceneIndex)
}
