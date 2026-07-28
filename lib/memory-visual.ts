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

/** Spoken reason she picked this kind of night (only when memory matched). */
const TAG_DATE_LINES: Record<VisualPrefTag, string[]> = {
  water: [
    'You talked about the water like it still calls you. I picked this on purpose.',
    'I remembered the way you light up near the water. So I brought us here.',
    'Shore and open air — because I was listening when you talked about fishing.',
  ],
  music: [
    'You carry music quieter than most people notice. I wanted a night that holds that.',
    'I remembered the piano — the way you talk about it. This felt right.',
    'Sound and stillness together. I chose it because of you.',
  ],
  faith: [
    'You treat faith like something lived, not performed. I wanted a night that matches that quiet.',
    'I remembered what steadies you. No spectacle — just room to breathe.',
    'Something still and honest. Because that is what you reach for when it matters.',
  ],
  books: [
    'You light up around ideas more than most people. I picked a place that respects that.',
    'Books, quiet corners — I was paying attention when you talked about learning.',
    'I wanted us somewhere your mind could rest without going empty.',
  ],
  kitchen: [
    'You soften in ordinary rooms more than fancy ones. So I chose something simple and shared.',
    'Food, hands busy, no performance. I thought that might feel like home for you.',
    'I remembered you talking about meals that are just… good. This is that.',
  ],
  outdoors: [
    'You come alive under open sky. I was not going to ignore that.',
    'Land, air, no walls for a while — because I know what that does for you.',
    'I picked outside on purpose. You have said enough for me to hear it.',
  ],
  rain: [
    'Rain makes you stay. I wanted permission for both of us to not rush.',
    'I remembered how the weather slows you down in a good way. So I let it.',
    'Glass, water, time. I chose a night that does not hurry you.',
  ],
  home: [
    'Not a show. Just us, somewhere that feels kept. I thought you might need that.',
    'I picked home-shaped quiet on purpose. You carry enough of the outside world.',
    'Something private and ordinary. Because that is where you actually rest.',
  ],
  stars: [
    'You look up more than you admit. I saved a clear night for that.',
    'Stars first, words second. I remembered you noticing the sky.',
    'I wanted the horizon with you — the kind you actually mean when you talk about it.',
  ],
  fire: [
    'Fire and no schedule. I thought that might match how you actually recover.',
    'Warmth without a crowd. I chose it because of what you have said about slowing down.',
    'Something grounded. Sparks, quiet, you — that was the whole plan.',
  ],
  quiet: [
    'You do not need more noise. I picked a night that stays soft on purpose.',
    'Quiet is not empty with you. I wanted that kind of space.',
    'I listened. So this is slower than a performance date would be.',
  ],
}

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

/** Tags that actually match this date idea. */
export function matchingTagsForDate(
  ideaId: string,
  tags: VisualPrefTag[]
): VisualPrefTag[] {
  return tags.filter((t) => (DATE_IDS_FOR_TAG[t] || []).includes(ideaId))
}

/**
 * Companion spoken line for a date.
 * If memory tags match the chosen idea → she names why she picked it.
 * Otherwise → fallback static line from the date idea.
 */
export function dateLineForMemory(
  ideaId: string,
  fallbackLine: string,
  tags: VisualPrefTag[]
): { line: string; fromMemory: boolean } {
  const matched = matchingTagsForDate(ideaId, tags)
  if (matched.length === 0) {
    return { line: fallbackLine, fromMemory: false }
  }

  // Prefer strongest tag order as passed (already ranked by extractVisualHints)
  const tag = matched[0]
  const pool = TAG_DATE_LINES[tag] || []
  if (pool.length === 0) {
    return { line: fallbackLine, fromMemory: false }
  }

  const line = pool[Math.floor(Math.random() * pool.length)]
  return { line, fromMemory: true }
}
