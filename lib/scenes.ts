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

export function sceneTier(affinity: number): number {
  if (affinity >= 24) return 7
  if (affinity >= 20) return 6
  if (affinity >= 16) return 5
  if (affinity >= 12) return 4
  if (affinity >= 9) return 3
  if (affinity >= 6) return 2
  if (affinity >= 3) return 1
  return 0
}

/** Deterministic pick so the same claim is stable; different sceneIndex → different vibe */
function pick<T>(arr: T[], seed: number): T {
  if (arr.length === 0) throw new Error('empty pick')
  const i = Math.abs(seed) % arr.length
  return arr[i]
}

function appearanceFor(def?: CompanionDef | null): string {
  if (def?.appearance?.trim()) return def.appearance.trim()
  if (!def) {
    return 'elegant silver foxkin woman, long silver-white hair, soft white fox ears, ice-blue eyes, graceful feminine figure'
  }
  return `beautiful adult ${def.race} woman named ${def.name}, ${def.className}, distinctive feminine features`
}

/** Race / species environmental + prop language */
function speciesFlavor(def?: CompanionDef | null): string[] {
  if (!def) return ['soft window light']
  const race = (def.race || '').toLowerCase()
  const slug = def.slug
  const bits: string[] = []

  if (race.includes('fox') || slug.includes('fox') || slug === 'seraphine') {
    bits.push(
      'subtle fox-ear expression',
      'tail curled with mood',
      'soft fur catching light',
      'delicate collar or silver charm at the throat'
    )
  }
  if (race.includes('cat') || race.includes('lion') || slug.includes('ashrunner') || slug.includes('ironmane')) {
    bits.push(
      'elegant thin collar with a small charm',
      'cat-ear tilt matching the mood',
      'tail arched or loosely draped',
      'slit-pupil glint in the eye'
    )
  }
  if (race.includes('dragon') || race.includes('fire') || slug.includes('ember') || slug.includes('crimson')) {
    bits.push(
      'ring of lit candles and low ember light',
      'heat shimmer in the air',
      'scale shimmer along collarbones',
      'warm coal glow on skin'
    )
  }
  if (race.includes('mermaid') || race.includes('sea') || race.includes('tide') || slug.includes('selene')) {
    bits.push(
      'moonlit water reflections',
      'damp hair strands',
      'bioluminescent freckles glowing softly',
      'salt air and tide-pool quiet'
    )
  }
  if (race.includes('fairy') || race.includes('shadow') || slug.includes('nyx')) {
    bits.push(
      'star-veil darkness behind her',
      'faint wing shimmer',
      'constellation dust in the air',
      'cool moon-silver light'
    )
  }
  if (race.includes('vampire') || slug.includes('vesper')) {
    bits.push(
      'candlelit gothic chamber',
      'wine-dark shadows',
      'subtle fang hint when she almost smiles',
      'velvet and old wood'
    )
  }
  if (race.includes('elf') || slug.includes('mira') || slug.includes('seris')) {
    bits.push(
      'library lamplight or night-window glow',
      'long pointed ears catching light',
      'ink or silver jewelry detail'
    )
  }
  if (race.includes('angel') || slug.includes('lyra') || slug.includes('oriana')) {
    bits.push(
      'soft feather-light rim light on wings',
      'warm sanctuary glow',
      'gold edge on white wings'
    )
  }
  if (race.includes('dryad') || race.includes('oak') || slug.includes('bramble') || slug.includes('nettle')) {
    bits.push(
      'garden night, leaves and soft moss',
      'flower or thorn detail in hair',
      'earth-sweet atmosphere'
    )
  }
  if (race.includes('golem') || race.includes('clay') || slug.includes('bok')) {
    bits.push(
      'gold kintsugi seams catching candlelight',
      'warm kiln-afterglow',
      'earnest living-statue stillness'
    )
  }
  if (race.includes('demon') || race.includes('devil') || slug.includes('ysolde') || slug.includes('sable')) {
    bits.push(
      'expensive shadow and red accent light',
      'horn silhouette sharp against the glow',
      'contract-ink or ribbon detail'
    )
  }

  if (bits.length === 0) {
    bits.push('moody practical lighting', 'lived-in private space')
  }
  return bits
}

/** Personality → pose/expression bias */
function personalityFlavor(def?: CompanionDef | null): string[] {
  if (!def) return ['calm present expression']
  const traits = (def.traits || []).map((t) => t.toLowerCase())
  const voice = (def.voice || '').toLowerCase()
  const bits: string[] = []

  if (traits.some((t) => t.includes('fierce') || t.includes('competitive') || t.includes('blunt'))) {
    bits.push('confident stance', 'challenging half-smile', 'physical ease in the body')
  }
  if (traits.some((t) => t.includes('shy') || t.includes('guarded') || t.includes('cautious'))) {
    bits.push('slightly averted gaze', 'hands close to the body', 'quiet intensity')
  }
  if (traits.some((t) => t.includes('playful') || t.includes('joyful') || t.includes('hopeful'))) {
    bits.push('bright eyes', 'almost-laugh at the corner of the mouth', 'light restless energy')
  }
  if (traits.some((t) => t.includes('predatory') || t.includes('dangerous') || voice.includes('dangerous'))) {
    bits.push('slow assessing gaze', 'controlled smile', 'predatory calm')
  }
  if (traits.some((t) => t.includes('loyal') || t.includes('protective') || t.includes('earnest'))) {
    bits.push('steady open posture', 'soft protective warmth in the eyes')
  }
  if (traits.some((t) => t.includes('precise') || t.includes('disciplined') || t.includes('observant'))) {
    bits.push('composed posture', 'sharp attentive eyes', 'no wasted motion')
  }
  if (bits.length === 0) {
    bits.push('emotionally present expression', 'natural posture')
  }
  return bits
}

const OUTFITS_BY_TIER: string[][] = [
  // 0 modest
  [
    'simple elegant day dress',
    'modest blouse and tailored trousers',
    'travel cloak over practical layers',
    'soft sweater and long skirt',
    'training wrap worn neatly',
  ],
  // 1 familiar
  [
    'nicer tailored coat and blouse',
    'flowing day dress with fine detail',
    'elegant high-collar coat',
    'soft layered robes',
    'casual fine shirt, sleeves rolled',
  ],
  // 2 warming
  [
    'light flowing dress',
    'silk blouse open at the throat',
    'evening wrap dress',
    'soft knit that sits close',
    'delicate formal wear, relaxed',
  ],
  // 3 tender
  [
    'soft off-shoulder garment',
    'open-collar evening blouse',
    'loose robe over underlayers',
    'backless evening dress still elegant',
    'thin-strap dress, private indoor wear',
  ],
  // 4 intimate
  [
    'elegant lingerie under a loosely draped silk robe',
    'tasteful lace bodysuit with a sheer wrap',
    'silk slip dress',
    'fine lingerie, robe slipping off one shoulder',
    'draped sheet and delicate undergarments',
  ],
  // 5 heated
  [
    'revealing elegant lingerie',
    'dark lace set, robe open',
    'minimal silk lingerie',
    'strappy elegant lingerie, still refined',
    'sheer robe over fitted lingerie',
  ],
  // 6 sensual
  [
    'sheer elegant lingerie',
    'very revealing lace, artful coverage',
    'translucent silk and little else',
    'barely-there elegant lingerie',
    'sheer fabric held rather than worn',
  ],
  // 7 peak
  [
    'minimal elegant sheer fabric',
    'almost nothing but artful drapery',
    'sheer lingerie reduced to lines and light',
    'strategic silk only',
    'intimate undress, fabric as suggestion',
  ],
]

const POSES_BY_TIER: string[][] = [
  [
    'standing, composed, three-quarter view',
    'seated upright, hands folded',
    'leaning lightly on a railing or window',
    'walking pause, looking back over one shoulder',
  ],
  [
    'relaxed three-quarter portrait',
    'seated, one knee drawn up casually',
    'standing with weight on one hip',
    'leaning in a doorway',
  ],
  [
    'slight lean toward the viewer',
    'seated closer, soft eye contact',
    'standing, hand near the collarbone',
    'profile turning into a glance',
  ],
  [
    'upper-body close, private quiet',
    'seated on a bed edge or low sill',
    'leaning against a wall, softer posture',
    'looking over the shoulder with warmth',
  ],
  [
    'close intimate framing',
    'sitting on the edge of a bed',
    'reclining on one elbow',
    'standing close, soft vulnerable posture',
  ],
  [
    'seated on bed or window seat, heated calm',
    'kneeling sit, open posture',
    'leaning back on hands',
    'close crop, breath-near intimacy',
  ],
  [
    'intimate pose on bed',
    'against a wall, close framing',
    'half-reclined, strong eye contact',
    'seated, legs drawn, private chamber',
  ],
  [
    'on bed, peak private gaze',
    'pressed gently back to wall or headboard',
    'intimate recline, minimal fabric',
    'close entangled framing with light and shadow',
  ],
]

const SETTINGS_BY_TIER: string[][] = [
  ['soft daylight interior', 'quiet courtyard', 'sunlit threshold', 'simple study'],
  ['warm ambient room', 'evening street-edge glow', 'cozy hearth side', 'library corner'],
  ['golden-hour window', 'lamplit sitting room', 'balcony at dusk', 'quiet garden edge'],
  ['private evening room', 'low indoor lamp', 'rain at the window', 'dim study nook'],
  ['bedroom warm light', 'private chamber', 'candlelit corner', 'moonlit window seat'],
  ['bedroom low light', 'intimate chamber', 'firelit room', 'night window and sheets'],
  ['private chamber soft shadows', 'candlelit bed space', 'moonlit intimate room'],
  ['candlelit or moonlight peak intimacy', 'private bedchamber', 'shadow-and-skin lighting'],
]

const STYLE_FLAVORS = [
  'semi-realistic anime, detailed skin and fabric',
  'refined anime illustration, cinematic lighting',
  'painterly anime, soft gradients and sharp eyes',
  'modern anime key-visual quality',
  'detailed anime portrait, shallow depth of field',
]

const EXPRESSION_BY_TIER: string[][] = [
  ['reserved calm expression', 'quiet neutral warmth'],
  ['gentle genuine smile', 'soft open expression'],
  ['soft affectionate eyes', 'small real smile'],
  ['tender expression', 'subtle blush'],
  ['soft parted lips', 'warm private look'],
  ['flushed cheeks, half-lidded eyes', 'heated but controlled expression'],
  ['strong blush, slightly parted lips', 'intense soft hunger in the eyes'],
  ['intense private gaze', 'breathless composure, peak intimacy'],
]

/**
 * Super-dynamic scene prompt: outfit × pose × setting × style × species × personality.
 * Seeded by sceneIndex + affinity so each claim differs without pure noise.
 */
export function buildScenePrompt(
  affinity: number,
  def?: CompanionDef | null,
  sceneIndex = 0
): string {
  const tier = sceneTier(affinity)
  const seed = sceneIndex * 17 + tier * 3 + (def?.slug?.length || 0) * 5 + affinity

  const look = appearanceFor(def)
  const name = def?.name || 'companion'

  const outfit = pick(OUTFITS_BY_TIER[tier] || OUTFITS_BY_TIER[0], seed)
  const pose = pick(POSES_BY_TIER[tier] || POSES_BY_TIER[0], seed + 1)
  const setting = pick(SETTINGS_BY_TIER[tier] || SETTINGS_BY_TIER[0], seed + 2)
  const style = pick(STYLE_FLAVORS, seed + 3)
  const expression = pick(EXPRESSION_BY_TIER[tier] || EXPRESSION_BY_TIER[0], seed + 4)

  const species = speciesFlavor(def)
  const personality = personalityFlavor(def)
  const speciesBit = pick(species, seed + 5)
  const speciesBit2 = pick(species, seed + 6)
  const personalityBit = pick(personality, seed + 7)

  const intimacyHint =
    tier >= 6
      ? 'borderline ecchi, sensual tension, tasteful adult romance art, never vulgar or crude'
      : tier >= 4
        ? 'romantic intimacy, elegant, tasteful'
        : tier >= 2
          ? 'emotional closeness, soft chemistry'
          : 'composed, approachable, not romantic yet'

  const quality =
    'masterpiece illustration of an adult woman, coherent anatomy, beautiful lighting, high detail, no text, no watermark'

  return [
    quality,
    style,
    `Character: ${look}`,
    `Name context: ${name}`,
    `Expression: ${expression}`,
    `Personality read: ${personalityBit}`,
    `Outfit: ${outfit}`,
    `Pose: ${pose}`,
    `Setting: ${setting}`,
    `Species / world detail: ${speciesBit}`,
    `Secondary atmosphere: ${speciesBit2}`,
    intimacyHint,
    'single character focus, clear face, feminine adult proportions',
  ].join('. ')
}
