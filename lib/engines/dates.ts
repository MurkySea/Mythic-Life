/**
 * Date ideas — weighted random nights out.
 * Common romance + rare adult pulls. Each idea can roll outfit/pose variants.
 *
 * Updated 2026-07-25:
 * Probability of adult / exclusive dates now scales with companion intimacy.
 * Low intimacy → almost exclusively modest/romantic dates.
 * High intimacy → adult dates become meaningfully common while modest dates retain residual weight.
 */

export type DateRarity = 'common' | 'uncommon' | 'rare'

export interface DateIdea {
  id: string
  title: string
  setting: string
  /** Primary outfit; variants roll for extra variety */
  outfit: string
  outfitVariants?: string[]
  pose: string
  poseVariants?: string[]
  mood: string
  line: string
  rarity: DateRarity
  adult?: boolean
}

function pickOne(primary: string, variants?: string[]): string {
  if (!variants?.length) return primary
  const pool = [primary, ...variants]
  return pool[Math.floor(Math.random() * pool.length)]
}

export const DATE_IDEAS: DateIdea[] = [
  // ——— Common ———
  {
    id: 'terrace_dinner',
    title: 'Terrace dinner',
    setting: 'soft city lights at dusk, elegant restaurant terrace, candlelit table for two',
    outfit: 'elegant evening dress, refined jewelry',
    outfitVariants: [
      'deep emerald cocktail dress, simple necklace',
      'cream satin blouse and tailored skirt',
      'wine-red wrap dress, soft earrings',
    ],
    pose: 'seated at a small table, soft eye contact, slight smile',
    poseVariants: [
      'leaning in across the table, chin on hand',
      'standing as the server leaves, adjusting a napkin',
    ],
    mood: 'warm, present, quietly happy',
    line: 'Candlelight suits you. I dressed up for this on purpose.',
    rarity: 'common',
  },
  {
    id: 'lantern_street',
    title: 'Lantern street walk',
    setting: 'warm lantern-lit cobblestone street, evening crowd soft in the background',
    outfit: 'tailored coat over a soft evening blouse, scarf',
    outfitVariants: [
      'long wool coat, boots, hair down',
      'leather jacket over a dress, casual heels',
    ],
    pose: 'walking pause under a streetlight, half-turn toward viewer',
    poseVariants: [
      'linked arms walking, glancing up at him',
      'stopping to look in a shop window, profile then smile',
    ],
    mood: 'playful, close, content',
    line: 'I would walk this street with you for hours.',
    rarity: 'common',
  },
  {
    id: 'rooftop_golden',
    title: 'Rooftop golden hour',
    setting: 'rooftop overlook, golden hour fading to night, city skyline soft',
    outfit: 'flowing formal dress with subtle detail, light wrap',
    outfitVariants: [
      'white summer dress catching the wind',
      'sleeveless black dress, gold bracelet',
    ],
    pose: 'leaning on a balcony rail, relaxed, wind in hair',
    poseVariants: [
      'standing against the rail, back to city, facing viewer',
      'sitting on the low wall, legs crossed, golden light',
    ],
    mood: 'serene, romantic, unhurried',
    line: 'The whole city below us and I still only notice you.',
    rarity: 'common',
  },
  {
    id: 'jazz_booth',
    title: 'Jazz booth',
    setting: 'quiet jazz bar booth, low candlelight, soft bokeh lights',
    outfit: 'classic little black dress, graceful',
    outfitVariants: [
      'dark green velvet dress',
      'silk camisole and tailored pants',
    ],
    pose: 'seated in a booth, chin lightly resting on hand, looking at viewer',
    poseVariants: [
      'leaning into the booth corner, soft smile',
      'holding a glass, eyes closed a moment to the music',
    ],
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
    poseVariants: [
      'sitting on a stone bench, shawl around shoulders',
      'walking the path ahead, looking back',
    ],
    mood: 'tender, quiet, devoted',
    line: 'I saved the quietest path for us.',
    rarity: 'common',
  },
  {
    id: 'bookstore_cafe',
    title: 'Bookstore café',
    setting: 'cozy bookstore café corner, warm lamps, stacked books',
    outfit: 'smart casual sweater dress, soft cardigan',
    outfitVariants: ['oversized knit sweater, jeans', 'plaid skirt, blouse, glasses optional'],
    pose: 'holding a book, seated by a window, soft eye contact',
    poseVariants: ['standing in the aisle between shelves', 'sharing a table, pointing at a page'],
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
    poseVariants: ['sitting on the pier edge, shoes off', 'leaning on the rail side-by-side'],
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
    poseVariants: ['walking the hall, looking back', 'seated on a bench in the gallery'],
    mood: 'thoughtful, close, refined',
    line: 'I liked the art. I liked standing next to you more.',
    rarity: 'common',
  },
  {
    id: 'cooking_together',
    title: 'Home kitchen',
    setting: 'warm home kitchen at night, soft overhead light, ingredients on counter',
    outfit: 'casual nice blouse, apron loosely worn',
    outfitVariants: ['his oversized shirt, apron', 'tank top and soft pants, hair tied up'],
    pose: 'leaning on the counter, playful smile, flour on fingers optional',
    poseVariants: ['stirring a pan, glancing over shoulder', 'tasting from a spoon, laughing'],
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
    poseVariants: ['lying back on the blanket pointing up', 'kneeling on the blanket wrapping the scarf'],
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
    poseVariants: ['forehead near the glass watching rain', 'sharing one side of the booth'],
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
    poseVariants: ['picking fruit from a stall', 'walking the aisle with a full bag'],
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
    poseVariants: ['spinning once, gown moving', 'hand on his shoulder, close hold'],
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
    poseVariants: ['asleep on his shoulder briefly', 'pointing out the window'],
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
    poseVariants: ['sitting cross-legged packing the basket', 'lying back with eyes closed in sun'],
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
    poseVariants: ['holding both his hands skating', 'fallen sitting on the ice laughing'],
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
    poseVariants: ['standing on a low ladder reaching a shelf', 'whispering across the table'],
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
    poseVariants: ['standing carefully at the bow', 'trailing a hand in the water'],
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
    poseVariants: ['pointing at the display case', 'outside the shop with steam from coffee'],
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
    poseVariants: ['wrapped in a shared blanket', 'poking the fire with a stick'],
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
    poseVariants: ['eye to the telescope eyepiece', 'sitting on the dome steps'],
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
    poseVariants: ['pouring tea carefully', 'hands folded in lap, soft eye contact'],
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
    poseVariants: ['eyes closed listening', 'hand lightly on his arm during the music'],
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
    poseVariants: ['seated on the engawa with tea', 'walking the wooden corridor'],
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
    poseVariants: ['in the passenger seat, knees up', 'on the hood sharing a blanket'],
    mood: 'nostalgic, fun, close',
    line: 'I forgot the movie. I remember you laughing.',
    rarity: 'common',
  },

  // ——— Rare adult — varied outfits & poses ———
  {
    id: 'lingerie_surprise',
    title: 'Lingerie surprise',
    setting: 'dim bedroom at home, soft bedside lamp, door just closed, private and quiet',
    outfit: 'elegant white lace lingerie set, matching robe slipping off one shoulder',
    outfitVariants: [
      'deep red satin babydoll with thin straps',
      'black lace bodysuit under an open silk robe',
      'pale blue sheer chemise, bare feet',
    ],
    pose: 'standing at the foot of the bed, waiting, soft confident smile',
    poseVariants: [
      'leaning in the doorway, one hand on the frame',
      'sitting on the edge of the bed, looking up at him',
      'kneeling on the bed, inviting him closer',
    ],
    mood: 'playful, devoted, deliberately chosen for him',
    line: 'I planned this for when you got home. Just us. No rush.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'boudoir_evening',
    title: 'Boudoir evening',
    setting: 'soft boudoir lighting, vanity mirror, silk sheets, warm shadows',
    outfit: 'black lace bra and garter set, sheer stockings, elegant not vulgar',
    outfitVariants: [
      'corset-style lingerie with ribbon ties, dark',
      'floral embroidered lingerie, soft pastels',
      'sheer white robe fully open over minimal lace',
    ],
    pose: 'looking back over her shoulder from the bed toward the viewer',
    poseVariants: [
      'seated at the vanity applying lipstick, meeting his eyes in the mirror',
      'lying on her side on silk sheets, propped on one elbow',
      'standing before the mirror, hands adjusting a strap',
    ],
    mood: 'intimate, self-possessed, inviting',
    line: 'I wanted you to see me like this — chosen, not accidental.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'silk_robe_morning',
    title: 'Silk robe morning',
    setting: 'sunlit bedroom morning, curtains half open, coffee on the nightstand',
    outfit: 'short ivory silk robe loosely tied, bare legs',
    outfitVariants: [
      'his button-down shirt only, sleeves rolled',
      'thin cotton slip dress, no bra, morning light',
      'towel wrapped loosely after a shower, hair damp',
    ],
    pose: 'sitting on the edge of the bed facing the viewer, robe slightly open at the collar',
    poseVariants: [
      'standing by the window with coffee, backlight',
      'half-lying across the bed, reaching toward him',
      'straddling a chair backward, chin on the backrest, teasing smile',
    ],
    mood: 'lazy, affectionate, unguarded',
    line: 'Stay. The morning is still ours.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'after_hours_hotel',
    title: 'After-hours hotel',
    setting: 'upscale hotel suite at night, city lights through the window, one lamp on',
    outfit: 'sheer black lingerie under an open tailored blazer, heels still on',
    outfitVariants: [
      'long coat only, closed with one hand, hint of lace beneath',
      'evening gown unzipped halfway down the back',
      'stockings and garter belt under a short hotel robe',
    ],
    pose: 'standing by the window then turning toward the viewer, coat or blazer open',
    poseVariants: [
      'sitting on the suite desk, legs crossed, blazer open',
      'leaning against the hotel door after closing it',
      'on the king bed, propped on pillows, waiting',
    ],
    mood: 'bold, rare, intentional',
    line: 'I booked the room. The rest is for you.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'bath_candlelight',
    title: 'Candlelit bath',
    setting: 'steamy bathroom, candles on the ledge, bubbles, soft condensation on mirrors',
    outfit: 'bare shoulders above the water, foam covering, hair pinned up loosely',
    outfitVariants: [
      'stepping out of the tub into a towel held loosely',
      'sitting on the tub edge wrapped in a towel, legs in the water',
    ],
    pose: 'in the tub looking up at him as he enters, relaxed smile',
    poseVariants: [
      'leaning back against the tub, eyes half-closed',
      'reaching a wet hand toward him',
    ],
    mood: 'soft, private, unhurried',
    line: 'I ran the water for two. Get in if you want.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'kitchen_midnight',
    title: 'Midnight kitchen',
    setting: 'dark kitchen at midnight, fridge light or under-cabinet glow only',
    outfit: 'oversized shirt barely buttoned, bare legs, no pants',
    outfitVariants: [
      'tank top and boy-short underwear, messy hair',
      'apron only over lingerie, playful',
    ],
    pose: 'leaning into the open fridge, looking back over her shoulder',
    poseVariants: [
      'sitting on the counter with a snack, swinging legs',
      'backed against the counter as he finds her',
    ],
    mood: 'playful, domestic, slightly naughty',
    line: 'Couldn’t sleep. Found you something better than leftovers.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'fireplace_rug',
    title: 'Fireplace rug',
    setting: 'living room fireplace, low flames, thick rug, no other lights',
    outfit: 'knit sweater falling off one shoulder, nothing else obvious, bare legs',
    outfitVariants: [
      'wrapped in a soft blanket only, shoulders bare',
      'lace bralette and soft shorts by the fire',
    ],
    pose: 'lying on the rug on her stomach, chin on hands, facing him',
    poseVariants: [
      'sitting cross-legged in the blanket, fire behind her',
      'curled against him on the rug, looking up',
    ],
    mood: 'warm, close, slow',
    line: 'The fire is enough light. Stay here.',
    rarity: 'rare',
    adult: true,
  },
  {
    id: 'dressing_room',
    title: 'Dressing room tease',
    setting: 'upscale store dressing room, mirror lights, curtain half open',
    outfit: 'trying on a sheer evening dress unzipped in the back, or lingerie she is “checking”',
    outfitVariants: [
      'half-changed, dress at her hips, looking at him in the mirror',
      'holding two lingerie options against herself, asking which',
    ],
    pose: 'facing the mirror, eyes meeting his through the reflection',
    poseVariants: [
      'turning toward him with the curtain held closed by one hand',
      'seated on the fitting bench, pulling him into the room',
    ],
    mood: 'teasing, bold, fun',
    line: 'Help me decide. Or don’t — just watch.',
    rarity: 'rare',
    adult: true,
  },
]

/**
 * Dynamic weight for rare/adult dates based on intimacy (0–100).
 * 
 * Curve design:
 * - 0–25 intimacy  → near-zero adult chance (modest/romantic dominate)
 * - 25–55          → gentle rise
 * - 55–80          → solid adult presence
 * - 80–100         → adult becomes a frequent, expected possibility
 * 
 * Common dates keep a residual floor so the relationship never becomes
 * exclusively sexual even at max intimacy.
 */
export function adultWeightForIntimacy(intimacy: number): number {
  const t = Math.max(0, Math.min(100, intimacy)) / 100
  // Quadratic ease-in keeps early relationship mostly wholesome
  // At intimacy 0  → ~0.4
  // At intimacy 50 → ~3.4
  // At intimacy 75 → ~7.1
  // At intimacy 100 → ~12.4  (comparable to the common weight of 10)
  return 0.4 + 12 * (t * t)
}

/**
 * Pick a date idea, optionally scaled by companion intimacy.
 * 
 * When intimacy is omitted the old fixed weights are used (backward compatible).
 * When intimacy is supplied, rare adult dates become progressively more likely.
 */
export function pickDateIdea(intimacy?: number): DateIdea {
  const useScaling = typeof intimacy === 'number'

  const weightFor = (idea: DateIdea): number => {
    if (!useScaling) {
      // Legacy fixed weights
      const fixed: Record<DateRarity, number> = { common: 10, uncommon: 4, rare: 1 }
      return fixed[idea.rarity]
    }

    if (idea.adult || idea.rarity === 'rare') {
      return adultWeightForIntimacy(intimacy!)
    }
    // Common / uncommon keep stable weight + small residual
    return idea.rarity === 'common' ? 10 : 4
  }

  const total = DATE_IDEAS.reduce((s, d) => s + weightFor(d), 0)
  let roll = Math.random() * total
  for (const idea of DATE_IDEAS) {
    roll -= weightFor(idea)
    if (roll <= 0) return idea
  }
  return DATE_IDEAS[0]
}

/** Resolve a concrete outfit/pose roll for this night. */
export function rollDatePresentation(idea: DateIdea): {
  outfit: string
  pose: string
} {
  return {
    outfit: pickOne(idea.outfit, idea.outfitVariants),
    pose: pickOne(idea.pose, idea.poseVariants),
  }
}

/** Build image prompt from a date idea + companion appearance. */
export function buildDatePromptFromIdea(
  idea: DateIdea,
  opts: { appearance: string; name: string; race?: string }
): string {
  const look = opts.appearance.trim()
  const { outfit, pose } = rollDatePresentation(idea)

  const tone = idea.adult
    ? [
        'intimate adult romantic illustration, tasteful sensuality, soft erotic atmosphere',
        'outfit and styling as described — alluring, varied, not crude or generic',
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
    `Outfit: ${outfit}`,
    `Pose: ${pose}`,
    `Setting: ${idea.setting}`,
    `expression: ${idea.mood} — not performative`,
    'single character focus, clear face, feminine adult proportions',
  ].join('. ')
}
