/**
 * Date ideas — random pick for companion night-out experiences.
 * Common romantic dates + a few rare adult-themed pulls.
 */

export type DateRarity = 'common' | 'uncommon' | 'rare'

export interface DateIdea {
  id: string
  title: string
  setting: string
  outfit: string
  pose: string
  mood: string
  line: string
  rarity: DateRarity
  /** Adult / intimate styling — changes image prompt guardrails */
  adult?: boolean
}

export const DATE_IDEAS: DateIdea[] = [
  {
    id: 'terrace_dinner',
    title: 'Terrace dinner',
    setting: 'soft city lights at dusk, elegant restaurant terrace, candlelit table for two',
    outfit: 'elegant evening dress, refined jewelry',
    pose: 'seated at a small table, soft eye contact, slight smile',
    mood: 'warm, present, quietly happy',
    line: 'Candlelight suits you. I dressed up for this on purpose.',
    rarity: 'common',
  },
  {
    id: 'lantern_street',
    title: 'Lantern street walk',
    setting: 'warm lantern-lit cobblestone street, evening crowd soft in the background',
    outfit: 'tailored coat over a soft evening blouse, scarf',
    pose: 'walking pause under a streetlight, half-turn toward viewer',
    mood: 'playful, close, content',
    line: 'I would walk this street with you for hours.',
    rarity: 'common',
  },
  {
    id: 'rooftop_golden',
    title: 'Rooftop golden hour',
    setting: 'rooftop overlook, golden hour fading to night, city skyline soft',
    outfit: 'flowing formal dress with subtle detail, light wrap',
    pose: 'leaning on a balcony rail, relaxed, wind in hair',
    mood: 'serene, romantic, unhurried',
    line: 'The whole city below us and I still only notice you.',
    rarity: 'common',
  },
  {
    id: 'jazz_booth',
    title: 'Jazz booth',
    setting: 'quiet jazz bar booth, low candlelight, soft bokeh lights',
    outfit: 'classic little black dress, graceful',
    pose: 'seated in a booth, chin lightly resting on hand, looking at viewer',
    mood: 'intimate, amused, soft',
    line: 'The music is fine. Being next to you is better.',
    rarity: 'common',
  },
  {
    id: 'moon_garden',
    title: 'Moonlit garden',
    setting: 'moonlit garden path after dinner, soft flowers, stone path',
    outfit: 'soft evening dress, light shawl',
    pose: 'standing on the path, gentle smile, looking toward viewer',
    mood: 'tender, quiet, devoted',
    line: 'I saved the quietest path for us.',
    rarity: 'common',
  },
  {
    id: 'bookstore_cafe',
    title: 'Bookstore café',
    setting: 'cozy bookstore café corner, warm lamps, stacked books',
    outfit: 'smart casual sweater dress, soft cardigan',
    pose: 'holding a book, seated by a window, soft eye contact',
    mood: 'curious, warm, at ease',
    line: 'You picked the café. I picked the corner with the best light.',
    rarity: 'common',
  },
  {
    id: 'pier_sunset',
    title: 'Pier at sunset',
    setting: 'wooden pier over calm water, sunset colors, gulls distant',
    outfit: 'light summer dress, cardigan over shoulders',
    pose: 'standing at the rail, wind in hair, looking back at viewer',
    mood: 'free, bright, affectionate',
    line: 'I wanted the horizon with you. This is it.',
    rarity: 'common',
  },
  {
    id: 'art_gallery',
    title: 'Late gallery night',
    setting: 'quiet art gallery evening, soft spotlights on paintings',
    outfit: 'elegant modern dress, simple heels',
    pose: 'standing before a painting, half-turned, soft smile',
    mood: 'thoughtful, close, refined',
    line: 'I liked the art. I liked standing next to you more.',
    rarity: 'common',
  },
  {
    id: 'cooking_together',
    title: 'Home kitchen',
    setting: 'warm home kitchen at night, soft overhead light, ingredients on counter',
    outfit: 'casual nice blouse, apron loosely worn',
    pose: 'leaning on the counter, playful smile, flour on fingers optional',
    mood: 'domestic, playful, intimate',
    line: 'Not a restaurant. Just us. I prefer this sometimes.',
    rarity: 'common',
  },
  {
    id: 'stargazing',
    title: 'Stargazing hill',
    setting: 'grassy hill under clear night sky, stars, distant town lights',
    outfit: 'warm sweater, scarf, comfortable trousers',
    pose: 'sitting on a blanket, looking up then toward viewer',
    mood: 'wonder, quiet, close',
    line: 'I saved a clear night for this. Look up with me.',
    rarity: 'common',
  },
  {
    id: 'rain_cafe',
    title: 'Rainy café window',
    setting: 'café window seat, rain on glass, steam from cups',
    outfit: 'soft turtleneck, wool coat draped on chair',
    pose: 'seated by the window, cup in hands, soft gaze',
    mood: 'cozy, reflective, warm',
    line: 'The rain made us stay longer. I am not complaining.',
    rarity: 'common',
  },
  {
    id: 'farmers_market',
    title: 'Morning market',
    setting: 'sunny farmers market aisle, flowers and produce, soft morning light',
    outfit: 'light sundress, straw bag',
    pose: 'holding flowers, bright smile, looking at viewer',
    mood: 'bright, alive, affectionate',
    line: 'I bought flowers. Not for the table — for the memory.',
    rarity: 'common',
  },
  {
    id: 'ballroom',
    title: 'Quiet ballroom',
    setting: 'empty ballroom after hours, chandeliers dimmed, polished floor',
    outfit: 'formal evening gown, elegant',
    pose: 'mid-step of a slow dance pose, looking at viewer',
    mood: 'grand, soft, romantic',
    line: 'No crowd. Just the floor and you. That was the point.',
    rarity: 'common',
  },
  {
    id: 'train_window',
    title: 'Evening train',
    setting: 'train window seat at dusk, blurred landscape, warm cabin light',
    outfit: 'travel coat, soft scarf',
    pose: 'seated by the window, profile then soft look to viewer',
    mood: 'thoughtful, traveling, together',
    line: 'I do not care where the train goes if you are on it.',
    rarity: 'common',
  },
  {
    id: 'picnic_meadow',
    title: 'Meadow picnic',
    setting: 'sunlit meadow picnic blanket, basket, soft grass',
    outfit: 'light blouse and skirt, barefoot optional',
    pose: 'reclining on the blanket, propped on elbow, smiling',
    mood: 'easy, sunny, open',
    line: 'No schedule. Just bread, fruit, and time.',
    rarity: 'common',
  },
  {
    id: 'ice_rink',
    title: 'Night rink',
    setting: 'outdoor ice rink at night, string lights, cold breath visible',
    outfit: 'knit sweater, scarf, gloves, skating skirt or pants',
    pose: 'on the ice, steadying, laughing soft eye contact',
    mood: 'playful, cold-rosy, fun',
    line: 'I almost fell. You noticed. That counts.',
    rarity: 'common',
  },
  {
    id: 'library_after',
    title: 'Library after hours',
    setting: 'grand library reading room, tall shelves, green lamps',
    outfit: 'smart blouse, cardigan, glasses optional',
    pose: 'seated at a long table with a book, looking up',
    mood: 'quiet, intellectual, warm',
    line: 'They closed the doors. We stayed among the books.',
    rarity: 'common',
  },
  {
    id: 'boat_harbor',
    title: 'Harbor boat',
    setting: 'small boat in a quiet harbor at twilight, water reflections',
    outfit: 'light jacket over dress, wind-tousled hair',
    pose: 'seated in the boat, looking across at viewer',
    mood: 'calm, adventurous, close',
    line: 'The water is still. So am I, with you.',
    rarity: 'common',
  },
  {
    id: 'bakery_dawn',
    title: 'Dawn bakery',
    setting: 'small bakery at opening, warm display cases, morning light',
    outfit: 'casual coat, soft scarf, hair loosely up',
    pose: 'holding a paper bag of pastries, bright soft smile',
    mood: 'simple, sweet, early',
    line: 'I woke up early so we could have the first loaves.',
    rarity: 'common',
  },
  {
    id: 'firepit',
    title: 'Firepit night',
    setting: 'backyard firepit, sparks rising, dark trees around',
    outfit: 'flannel or thick sweater, jeans, cozy',
    pose: 'sitting by the fire, hands warming, soft look to viewer',
    mood: 'grounded, intimate, unhurried',
    line: 'No tickets. No reservation. Just fire and us.',
    rarity: 'common',
  },
  {
    id: 'observatory',
    title: 'Observatory visit',
    setting: 'observatory dome interior or balcony, night sky instruments',
    outfit: 'smart casual dress, light jacket',
    pose: 'standing near a telescope, looking from stars to viewer',
    mood: 'wonder, precise, close',
    line: 'They showed us galaxies. I kept looking at you.',
    rarity: 'common',
  },
  {
    id: 'tea_house',
    title: 'Tea house',
    setting: 'traditional tea house, low table, soft natural light through screens',
    outfit: 'simple elegant dress or kimono-inspired formal wear, tasteful',
    pose: 'kneeling or seated at low table, calm smile',
    mood: 'still, respectful, intimate',
    line: 'Slow tea. Slow words. I needed this with you.',
    rarity: 'common',
  },
  {
    id: 'concert_hall',
    title: 'Concert balcony',
    setting: 'concert hall balcony box, stage lights soft in distance',
    outfit: 'formal evening dress, earrings',
    pose: 'seated in the box, leaning slightly toward viewer',
    mood: 'elevated, moved, shared',
    line: 'The music was excellent. Your shoulder next to mine was the real ticket.',
    rarity: 'common',
  },
  {
    id: 'hot_springs',
    title: 'Mountain inn evening',
    setting: 'mountain inn outdoor view deck at dusk, steam distant, lanterns',
    outfit: 'yukata-style or soft robe over evening wear, modest and elegant',
    pose: 'standing at the rail looking at mountains, soft profile then gaze',
    mood: 'rested, warm, private',
    line: 'A night away from everything except you.',
    rarity: 'common',
  },
  {
    id: 'drive_in',
    title: 'Drive-in night',
    setting: 'vintage drive-in movie under stars, car hood or blanket, screen glow',
    outfit: 'casual nice jacket, jeans, soft shirt',
    pose: 'leaning against the car, looking at viewer not the screen',
    mood: 'nostalgic, fun, close',
    line: 'I forgot the movie. I remember you laughing.',
    rarity: 'common',
  },

  // Rare adult-themed (~4% combined with weight 1 vs common 10)
  {
    id: 'lingerie_surprise',
    title: 'Lingerie surprise',
    setting:
      'dim bedroom at home, soft bedside lamp, door just closed, private and quiet',
    outfit:
      'elegant sheer lingerie set, lace bra and matching bottoms, robe slipping off one shoulder',
    pose:
      'standing in the doorway or at the foot of the bed, waiting for him, soft confident smile',
    mood: 'playful, devoted, deliberately chosen for him',
    line: 'I planned this for when you got home. Just us. No rush.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'boudoir_evening',
    title: 'Boudoir evening',
    setting:
      'soft boudoir lighting, vanity mirror, silk sheets, warm shadows',
    outfit:
      'tasteful boudoir lingerie, garter details optional, elegant not vulgar',
    pose:
      'reclining on the bed or seated at the vanity, looking back over her shoulder at the viewer',
    mood: 'intimate, self-possessed, inviting',
    line: 'I wanted you to see me like this — chosen, not accidental.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'silk_robe_morning',
    title: 'Silk robe morning',
    setting:
      'sunlit bedroom morning, curtains half open, coffee on the nightstand',
    outfit:
      'short silk robe loosely tied, bare legs, soft morning hair',
    pose:
      'sitting on the edge of the bed facing the viewer, robe slightly open at the collar',
    mood: 'lazy, affectionate, unguarded',
    line: 'Stay. The morning is still ours.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'after_hours_hotel',
    title: 'After-hours hotel',
    setting:
      'upscale hotel suite at night, city lights through the window, one lamp on',
    outfit:
      'sheer black lingerie under an open blazer or coat, heels still on',
    pose:
      'standing by the window then turning toward the viewer, coat open',
    mood: 'bold, rare, intentional',
    line: 'I booked the room. The rest is for you.',
    rarity: 'rare',
    adult: true,
  },
]

const WEIGHT: Record<DateRarity, number> = {
  common: 10,
  uncommon: 4,
  rare: 1,
}

/** Weighted pick — rare adult dates are uncommon pulls. */
export function pickDateIdea(): DateIdea {
  const total = DATE_IDEAS.reduce((s, d) => s + WEIGHT[d.rarity], 0)
  let roll = Math.random() * total
  for (const idea of DATE_IDEAS) {
    roll -= WEIGHT[idea.rarity]
    if (roll <= 0) return idea
  }
  return DATE_IDEAS[0]
}

/** Build image prompt from a date idea + companion appearance. */
export function buildDatePromptFromIdea(
  idea: DateIdea,
  opts: { appearance: string; name: string; race?: string }
): string {
  const look = opts.appearance.trim()
  const tone = idea.adult
    ? [
        'intimate adult romantic illustration, tasteful sensuality, soft erotic atmosphere',
        'elegant lingerie or boudoir styling as described — alluring, not crude',
        'adult woman, coherent anatomy, beautiful lighting, high detail, no text, no watermark',
      ]
    : [
        'masterpiece illustration of an adult woman, coherent anatomy, beautiful lighting, high detail, no text, no watermark',
        'romantic atmosphere, tasteful, fully clothed, soft chemistry',
      ]

  return [
    ...tone,
    'refined anime key-visual quality, cinematic',
    `Character: ${look}`,
    `Name context: ${opts.name}`,
    `Date: ${idea.title}`,
    `Outfit: ${idea.outfit}`,
    `Pose: ${idea.pose}`,
    `Setting: ${idea.setting}`,
    `expression: ${idea.mood} — not performative`,
    'single character focus, clear face, feminine adult proportions',
  ].join('. ')
}
