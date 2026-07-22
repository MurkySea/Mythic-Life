import type { CompanionDef } from './companions'

/** Affinity required to unlock each successive scene slot (1 scene per milestone) */
export const SCENE_MILESTONES = [1, 3, 6, 9, 12, 16, 20, 24] as const

export function scenesEarned(affinity: number): number {
  let n = 0
  for (const m of SCENE_MILESTONES) {
    if (affinity >= m) n++
    else break
  }
  return Math.max(1, n)
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

/** Prefer canon appearance string; fall back by race so Grok + Bible casts both work */
function appearanceFor(def?: CompanionDef | null): string {
  if (def?.appearance?.trim()) return def.appearance.trim()
  if (!def) {
    return 'elegant silver foxkin woman, long silver-white hair, white fox ears, ice-blue eyes'
  }
  return `${def.race} ${def.className} named ${def.name}, distinctive features matching their canon`
}

/** Personality tint so Sable scenes don't read like Nettle scenes */
function moodFor(def?: CompanionDef | null, tier = 0): string {
  if (!def) return ''
  const slug = def.slug
  if (slug === 'sable_vex') {
    return tier >= 4
      ? 'predatory intimate gaze, dangerous allure, possessive heat'
      : 'knowing half-smile, predatory calm, expensive menace'
  }
  if (slug === 'nettle_softbriar') {
    return tier >= 4
      ? 'small fierce tenderness, garden-wild intimacy, thorn-sweet'
      : 'sweet steel, tiny but unignorable presence'
  }
  if (slug === 'bok_unfinished') {
    return 'earnest carved face, gentle giant stillness, gold repair seams catching light'
  }
  if (slug === 'mirelle_glasslung') {
    return tier >= 4
      ? 'salt-wet melancholy, intimate quiet after drowning, soft hunger for air'
      : 'calm after the wave, tide in the chest, understated beauty'
  }
  if (slug === 'ysolde_nightbargain') {
    return tier >= 4
      ? 'contract-devil softness, unfair beauty, eyes that calculate and yield'
      : 'lawyer-precise smile, ribbon-wrapped horns, dangerous courtesy'
  }
  if (slug === 'magpie_rue') {
    return 'corvid cleverness, bright dark eyes, pockets full of secrets'
  }
  if (slug === 'ember_crimsonfall') {
    return tier >= 4 ? 'competitive heat, physical confidence, battle-scarred sensuality' : 'fierce grin, training-ground energy'
  }
  if (slug === 'seris_nightthorn') {
    return tier >= 4 ? 'controlled intimacy, violet-eyed assessment, rare unguarded moment' : 'economical expression, lethal stillness'
  }
  return ''
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

  const mood = moodFor(def, tier)
  const moodBit = mood ? `, ${mood}` : ''

  const variants: string[] = [
    `${quality}. Full-body portrait of ${look}${moodBit}, reserved calm expression, simple elegant day clothes, modest, standing in soft daylight, composed and distant-friendly, introduction portrait of ${name}`,
    `${quality}. Three-quarter portrait of ${look}${moodBit}, gentle genuine smile, nicer tailored outfit, relaxed posture, warm ambient light, growing familiarity with the viewer, ${name}`,
    `${quality}. Close portrait of ${look}${moodBit}, soft affectionate eyes, light flowing dress or blouse, slight lean toward viewer, golden-hour warmth, emotional closeness without romance yet, ${name}`,
    `${quality}. Intimate upper-body portrait of ${look}${moodBit}, tender expression, evening indoor light, open-collar or soft off-shoulder garment, subtle blush, private quiet moment, romantic tension beginning, ${name}`,
    `${quality}. Intimate anime portrait of ${look}${moodBit}, soft parted lips, warm bedroom or private chamber lighting, elegant lingerie or loosely draped silk, close framing, clear romantic intimacy, tasteful, ${name}`,
    `${quality}. Sensual anime illustration of ${look}${moodBit}, flushed cheeks, half-lidded eyes, revealing elegant lingerie, sitting on edge of bed or window seat, warm low light, heated but graceful atmosphere, ${name}`,
    `${quality}. Borderline ecchi anime illustration of ${look}${moodBit}, strong blush, slightly parted lips, sheer or very revealing elegant lingerie, intimate private chamber, soft shadows, explicit sensual tension while remaining beautiful and composed, ${name}`,
    `${quality}. Highly intimate borderline ecchi anime scene of ${look}${moodBit}, intense private gaze, minimal elegant sheer fabric, intimate pose on bed or against wall, candlelit or moonlight, peak sensual bond, tasteful adult romance art, never vulgar, ${name}`,
  ]

  const idx = Math.min(
    variants.length - 1,
    Math.max(tier, Math.min(sceneIndex, variants.length - 1))
  )
  return variants[idx]
}
