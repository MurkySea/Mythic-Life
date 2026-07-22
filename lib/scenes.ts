import type { CompanionDef } from './companions'

/** Affinity required to unlock each successive scene slot (1 scene per milestone) */
export const SCENE_MILESTONES = [1, 3, 6, 9, 12, 16, 20, 24] as const

export function scenesEarned(affinity: number): number {
  let n = 0
  for (const m of SCENE_MILESTONES) {
    if (affinity >= m) n++
    else break
  }
  return Math.max(1, n) // always at least the first portrait slot at affinity 1
}

export function nextSceneMilestone(affinity: number): number | null {
  for (const m of SCENE_MILESTONES) {
    if (affinity < m) return m
  }
  return null
}

export function getIntimacyLabel(affinity: number): string {
  if (affinity >= 24) return 'Bound Beyond Words'
  if (affinity >= 20) return 'Intense & Sensual'
  if (affinity >= 16) return 'Heated Intimacy'
  if (affinity >= 12) return 'Deeply Intimate'
  if (affinity >= 9) return 'Close & Tender'
  if (affinity >= 6) return 'Warming Bond'
  if (affinity >= 3) return 'Growing Familiar'
  return 'Quiet Companion'
}

/** Visual identity baked into every prompt so companions don't all look like Seraphine */
function appearanceFor(def?: CompanionDef | null): string {
  if (!def) {
    return 'elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes'
  }
  switch (def.slug) {
    case 'seraphine':
      return 'elegant silver foxkin woman, long silver-white hair, soft white fox ears, ice-blue eyes, refined features'
    case 'kira_foxveil':
      return 'warm red fox foxkin woman, auburn-red hair, matching fox ears, amber eyes, gentle devoted expression'
    case 'ember_crimsonfall':
      return 'fierce fire dragonkin woman, crimson-black hair, small horns, gold-red eyes, athletic powerful presence'
    case 'nyx_voidbane':
      return 'ethereal shadow fairy woman, dark violet hair, translucent wings hints, starlit eyes, otherworldly calm'
    case 'mira_quillweave':
      return 'precise high elf woman, pale blonde hair, pointed ears, sharp intelligent eyes, scholarly grace'
    case 'lyra_dawnforge':
      return 'guardian angel woman, golden hair, soft luminous wings, steadfast blue eyes, protective presence'
    case 'kael_ashrunner':
      return 'reserved grey wolfkin, ash-grey hair, wolf ears, steady gold eyes, outdoors-hardened calm'
    case 'selene_tideglass':
      return 'deep-sea mermaid woman, teal-dark hair, subtle scales, ocean-blue eyes, restorative gentleness'
    default:
      return `${def.race} ${def.className}, distinctive features matching ${def.name}`
  }
}

/**
 * Progressive scene prompts — each tier must read clearly different.
 * Highest tiers are borderline ecchi / sensual, still elegant, never crude.
 */
export function buildScenePrompt(
  affinity: number,
  def?: CompanionDef | null,
  sceneIndex = 0
): string {
  const look = appearanceFor(def)
  const name = def?.name || 'companion'
  const quality =
    'masterpiece anime illustration, detailed, coherent anatomy, beautiful lighting, high quality'

  // Tier by affinity (and slightly by which scene slot you're claiming)
  const tier =
    affinity >= 24
      ? 7
      : affinity >= 20
        ? 6
        : affinity >= 16
          ? 5
          : affinity >= 12
            ? 4
            : affinity >= 9
              ? 3
              : affinity >= 6
                ? 2
                : affinity >= 3
                  ? 1
                  : 0

  const variants: string[] = [
    // 0 — Affinity 1: reserved introduction
    `${quality}. Full-body portrait of ${look}, reserved calm expression, simple elegant day clothes, modest, standing in soft daylight, composed and distant-friendly, introduction portrait of ${name}`,
    // 1 — Affinity 3: familiar warmth
    `${quality}. Three-quarter portrait of ${look}, gentle genuine smile, nicer tailored outfit, relaxed posture, warm ambient light, growing familiarity with the viewer, ${name}`,
    // 2 — Affinity 6: softening bond
    `${quality}. Close portrait of ${look}, soft affectionate eyes, light flowing dress or blouse, slight lean toward viewer, golden-hour warmth, emotional closeness without romance yet, ${name}`,
    // 3 — Affinity 9: tender
    `${quality}. Intimate upper-body portrait of ${look}, tender expression, evening indoor light, open-collar or soft off-shoulder garment, subtle blush, private quiet moment, romantic tension beginning, ${name}`,
    // 4 — Affinity 12: deeply intimate
    `${quality}. Intimate anime portrait of ${look}, soft parted lips, warm bedroom or private chamber lighting, elegant lingerie or loosely draped silk, close framing, clear romantic intimacy, tasteful, ${name}`,
    // 5 — Affinity 16: heated
    `${quality}. Sensual anime illustration of ${look}, flushed cheeks, half-lidded eyes, revealing elegant lingerie, sitting on edge of bed or window seat, warm low light, heated but graceful atmosphere, ${name}`,
    // 6 — Affinity 20: borderline ecchi
    `${quality}. Borderline ecchi anime illustration of ${look}, strong blush, slightly parted lips, sheer or very revealing elegant lingerie, intimate private chamber, soft shadows, explicit sensual tension while remaining beautiful and composed, ${name}`,
    // 7 — Affinity 24+: peak private
    `${quality}. Highly intimate borderline ecchi anime scene of ${look}, intense private gaze, minimal elegant sheer fabric, intimate pose on bed or against wall, candlelit or moonlight, peak sensual bond, tasteful adult romance art, never vulgar, ${name}`,
  ]

  // Prefer affinity tier; nudge with sceneIndex so successive claims at same tier still vary slightly
  const idx = Math.min(variants.length - 1, Math.max(tier, Math.min(sceneIndex, variants.length - 1)))
  return variants[idx]
}
