/**
 * Turn companion memories into soft visual / date-selection hints.
 * Never forced — 0–2 flavor lines max. Image models stay coherent.
 */

import { createClient } from '@/utils/supabase/server'

export type VisualPrefTag =
  | 'water'
  | 'music'
  | 'faith'
  | 'books'
  | 'kitchen'
  | 'outdoors'
  | 'rain'
  | 'home'
  | 'stars'
  | 'fire'
  | 'quiet'

const TAG_PATTERNS: { tag: VisualPrefTag; test: RegExp; visualLine: string }[] = [
  {
    tag: 'water',
    test: /\b(fish|fishing|river|lake|pier|boat|harbor|water|bass|gar)\b/i,
    visualLine: 'subtle water or shoreline atmosphere if it fits the scene',
  },
  {
    tag: 'music',
    test: /\b(piano|music|song|concert|jazz|melody)\b/i,
    visualLine: 'soft musical atmosphere or instrument detail if natural',
  },
  {
    tag: 'faith',
    test: /\b(church|bible|faith|pray|prayer|god|worship|sermon|steward)\b/i,
    visualLine: 'quiet reverent calm — soft light, still air, no spectacle',
  },
  {
    tag: 'books',
    test: /\b(book|books|read|reading|library|learn|study)\b/i,
    visualLine: 'books, paper, or lamplit study texture if the setting allows',
  },
  {
    tag: 'kitchen',
    test: /\b(cook|cooking|kitchen|food|bake|baking|meal)\b/i,
    visualLine: 'domestic kitchen warmth or shared meal energy if fitting',
  },
  {
    tag: 'outdoors',
    test: /\b(land|homestead|hike|outdoor|nature|woods|trail|garden)\b/i,
    visualLine: 'open air, earth, or living green if the scene can hold it',
  },
  {
    tag: 'rain',
    test: /\b(rain|rainy|storm)\b/i,
    visualLine: 'rain on glass or post-rain quiet if it matches mood',
  },
  {
    tag: 'home',
    test: /\b(home|house|wife|lauren|family)\b/i,
    visualLine: 'lived-in private home warmth rather than a public stage',
  },
  {
    tag: 'stars',
    test: /\b(star|stars|night sky|stargaz)\b/i,
    visualLine: 'clear night sky or starlight if outdoors',
  },
  {
    tag: 'fire',
    test: /\b(fire|firepit|campfire|hearth|fireplace)\b/i,
    visualLine: 'firelight, sparks, or hearth glow if intimate and still',
  },
  {
    tag: 'quiet',
    test: /\b(quiet|silence|still|peace|rest|sleep|slow)\b/i,
    visualLine: 'unhurried quiet — no crowd, no noise, space to breathe',
  },
]

/** Date idea ids that match a preference tag (soft boost only). */
export const DATE_IDS_FOR_TAG: Record<VisualPrefTag, string[]> = {
  water: ['pier_sunset', 'boat_harbor', 'hot_springs'],
  music: ['jazz_booth', 'concert_hall'],
  faith: ['tea_house', 'moon_garden', 'stargazing'],
  books: ['bookstore_cafe', 'library_after', 'art_gallery'],
  kitchen: ['cooking_together', 'bakery_dawn', 'farmers_market'],
  outdoors: ['picnic_meadow', 'pier_sunset', 'stargazing', 'farmers_market', 'firepit'],
  rain: ['rain_cafe', 'train_window'],
  home: ['cooking_together', 'firepit', 'silk_robe_morning'],
  stars: ['stargazing', 'observatory', 'rooftop_golden'],
  fire: ['firepit', 'fireplace_rug'],
  quiet: ['tea_house', 'moon_garden', 'library_after', 'rain_cafe'],
}

function parseMemoryText(raw: string): string {
  const match = raw.match(/^\[(\w+):(\d+)\]\s*([\s\S]*)$/)
  return (match ? match[3] : raw).trim()
}

/** Pure: memories → unique tags + short visual lines (max 2). */
export function extractVisualHints(memoryTexts: string[]): {
  tags: VisualPrefTag[]
  lines: string[]
} {
  const tagHits = new Map<VisualPrefTag, number>()

  for (const raw of memoryTexts) {
    const text = parseMemoryText(raw)
    if (!text) continue
    for (const row of TAG_PATTERNS) {
      if (row.test.test(text)) {
        tagHits.set(row.tag, (tagHits.get(row.tag) || 0) + 1)
      }
    }
  }

  const ranked = [...tagHits.entries()].sort((a, b) => b[1] - a[1])
  const tags = ranked.slice(0, 4).map(([t]) => t)
  const lines = tags
    .slice(0, 2)
    .map((t) => TAG_PATTERNS.find((p) => p.tag === t)?.visualLine)
    .filter((x): x is string => Boolean(x))

  return { tags, lines }
}

/** Load recent companion memories and extract visual preference hints. */
export async function loadVisualMemoryHints(companionSlug: string): Promise<{
  tags: VisualPrefTag[]
  lines: string[]
}> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('companion_memories')
      .select('content')
      .eq('companion_slug', companionSlug)
      .order('created_at', { ascending: false })
      .limit(40)

    const texts = (data || []).map((r) => r.content || '').filter(Boolean)
    return extractVisualHints(texts)
  } catch (e) {
    console.error('loadVisualMemoryHints failed', e)
    return { tags: [], lines: [] }
  }
}

/** Soft weight multiplier for a date idea given preference tags. */
export function datePreferenceBoost(
  ideaId: string,
  tags: VisualPrefTag[]
): number {
  if (tags.length === 0) return 1
  let boost = 1
  for (const tag of tags) {
    const ids = DATE_IDS_FOR_TAG[tag] || []
    if (ids.includes(ideaId)) boost += 0.85
  }
  return Math.min(boost, 3.2)
}
