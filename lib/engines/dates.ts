/**
 * Date ideas — random pick for companion night-out experiences.
 * ~25 distinct scenarios so dates feel different every time.
 */

export interface DateIdea {
  id: string
  title: string
  setting: string
  outfit: string
  pose: string
  mood: string
  /** Short line she might say after */
  line: string
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
  },
  {
    id: 'lantern_street',
    title: 'Lantern street walk',
    setting: 'warm lantern-lit cobblestone street, evening crowd soft in the background',
    outfit: 'tailored coat over a soft evening blouse, scarf',
    pose: 'walking pause under a streetlight, half-turn toward viewer',
    mood: 'playful, close, content',
    line: 'I would walk this street with you for hours.',
  },
  {
    id: 'rooftop_golden',
    title: 'Rooftop golden hour',
    setting: 'rooftop overlook, golden hour fading to night, city skyline soft',
    outfit: 'flowing formal dress with subtle detail, light wrap',
    pose: 'leaning on a balcony rail, relaxed, wind in hair',
    mood: 'serene, romantic, unhurried',
    line: 'The whole city below us and I still only notice you.',
  },
  {
    id: 'jazz_booth',
    title: 'Jazz booth',
    setting: 'quiet jazz bar booth, low candlelight, soft bokeh lights',
    outfit: 'classic little black dress, graceful',
    pose: 'seated in a booth, chin lightly resting on hand, looking at viewer',
    mood: 'intimate, amused, soft',
    line: 'The music is fine. Being next to you is better.',
  },
  {
    id: 'moon_garden',
    title: 'Moonlit garden',
    setting: 'moonlit garden path after dinner, soft flowers, stone path',
    outfit: 'soft evening dress, light shawl',
    pose: 'standing on the path, gentle smile, looking toward viewer',
    mood: 'tender, quiet, devoted',
    line: 'I saved the quietest path for us.',
  },
  {
    id: 'bookstore_cafe',
    title: 'Bookstore café',
    setting: 'cozy bookstore café corner, warm lamps, stacked books',
    outfit: 'smart casual sweater dress, soft cardigan',
    pose: 'holding a book, seated by a window, soft eye contact',
    mood: 'curious, warm, at ease',
    line: 'You picked the café. I picked the corner with the best light.',
  },
  {
    id: 'pier_sunset',
    title: 'Pier at sunset',
    setting: 'wooden pier over calm water, sunset colors, gulls distant',
    outfit: 'light summer dress, cardigan over shoulders',
    pose: 'standing at the rail, wind in hair, looking back at viewer',
    mood: 'free, bright, affectionate',
    line: 'I wanted the horizon with you. This is it.',
  },
  {
    id: 'art_gallery',
    title: 'Late gallery night',
    setting: 'quiet art gallery evening, soft spotlights on paintings',
    outfit: 'elegant modern dress, simple heels',
    pose: 'standing before a painting, half-turned, soft smile',
    mood: 'thoughtful, close, refined',
    line: 'I liked the art. I liked standing next to you more.',
  },
  {
    id: 'cooking_together',
    title: 'Home kitchen',
    setting: 'warm home kitchen at night, soft overhead light, ingredients on counter',
    outfit: 'casual nice blouse, apron loosely worn',
    pose: 'leaning on the counter, playful smile, flour on fingers optional',
    mood: 'domestic, playful, intimate',
    line: 'Not a restaurant. Just us. I prefer this sometimes.',
  },
  {
    id: 'stargazing',
    title: 'Stargazing hill',
    setting: 'grassy hill under clear night sky, stars, distant town lights',
    outfit: 'warm sweater, scarf, comfortable trousers',
    pose: 'sitting on a blanket, looking up then toward viewer',
    mood: 'wonder, quiet, close',
    line: 'I saved a clear night for this. Look up with me.',
  },
  {
    id: 'rain_cafe',
    title: 'Rainy café window',
    setting: 'café window seat, rain on glass, steam from cups',
    outfit: 'soft turtleneck, wool coat draped on chair',
    pose: 'seated by the window, cup in hands, soft gaze',
    mood: 'cozy, reflective, warm',
    line: 'The rain made us stay longer. I am not complaining.',
  },
  {
    id: 'farmers_market',
    title: 'Morning market',
    setting: 'sunny farmers market aisle, flowers and produce, soft morning light',
    outfit: 'light sundress, straw bag',
    pose: 'holding flowers, bright smile, looking at viewer',
    mood: 'bright, alive, affectionate',
    line: 'I bought flowers. Not for the table — for the memory.',
  },
  {
    id: 'ballroom',
    title: 'Quiet ballroom',
    setting: 'empty ballroom after hours, chandeliers dimmed, polished floor',
    outfit: 'formal evening gown, elegant',
    pose: 'mid-step of a slow dance pose, looking at viewer',
    mood: 'grand, soft, romantic',
    line: 'No crowd. Just the floor and you. That was the point.',
  },
  {
    id: 'train_window',
    title: 'Evening train',
    setting: 'train window seat at dusk, blurred landscape, warm cabin light',
    outfit: 'travel coat, soft scarf',
    pose: 'seated by the window, profile then soft look to viewer',
    mood: 'thoughtful, traveling, together',
    line: 'I do not care where the train goes if you are on it.',
  },
  {
    id: 'picnic_meadow',
    title: 'Meadow picnic',
    setting: 'sunlit meadow picnic blanket, basket, soft grass',
    outfit: 'light blouse and skirt, barefoot optional',
    pose: 'reclining on the blanket, propped on elbow, smiling',
    mood: 'easy, sunny, open',
    line: 'No schedule. Just bread, fruit, and time.',
  },
  {
    id: 'ice_rink',
    title: 'Night rink',
    setting: 'outdoor ice rink at night, string lights, cold breath visible',
    outfit: 'knit sweater, scarf, gloves, skating skirt or pants',
    pose: 'on the ice, steadying, laughing soft eye contact',
    mood: 'playful, cold-rosy, fun',
    line: 'I almost fell. You noticed. That counts.',
  },
  {
    id: 'library_after',
    title: 'Library after hours',
    setting: 'grand library reading room, tall shelves, green lamps',
    outfit: 'smart blouse, cardigan, glasses optional',
    pose: 'seated at a long table with a book, looking up',
    mood: 'quiet, intellectual, warm',
    line: 'They closed the doors. We stayed among the books.',
  },
  {
    id: 'boat_harbor',
    title: 'Harbor boat',
    setting: 'small boat in a quiet harbor at twilight, water reflections',
    outfit: 'light jacket over dress, wind-tousled hair',
    pose: 'seated in the boat, looking across at viewer',
    mood: 'calm, adventurous, close',
    line: 'The water is still. So am I, with you.',
  },
  {
    id: 'bakery_dawn',
    title: 'Dawn bakery',
    setting: 'small bakery at opening, warm display cases, morning light',
    outfit: 'casual coat, soft scarf, hair loosely up',
    pose: 'holding a paper bag of pastries, bright soft smile',
    mood: 'simple, sweet, early',
    line: 'I woke up early so we could have the first loaves.',
  },
  {
    id: 'firepit',
    title: 'Firepit night',
    setting: 'backyard firepit, sparks rising, dark trees around',
    outfit: 'flannel or thick sweater, jeans, cozy',
    pose: 'sitting by the fire, hands warming, soft look to viewer',
    mood: 'grounded, intimate, unhurried',
    line: 'No tickets. No reservation. Just fire and us.',
  },
  {
    id: 'observatory',
    title: 'Observatory visit',
    setting: 'observatory dome interior or balcony, night sky instruments',
    outfit: 'smart casual dress, light jacket',
    pose: 'standing near a telescope, looking from stars to viewer',
    mood: 'wonder, precise, close',
    line: 'They showed us galaxies. I kept looking at you.',
  },
  {
    id: 'tea_house',
    title: 'Tea house',
    setting: 'traditional tea house, low table, soft natural light through screens',
    outfit: 'simple elegant dress or kimono-inspired formal wear, tasteful',
    pose: 'kneeling or seated at low table, calm smile',
    mood: 'still, respectful, intimate',
    line: 'Slow tea. Slow words. I needed this with you.',
  },
  {
    id: 'concert_hall',
    title: 'Concert balcony',
    setting: 'concert hall balcony box, stage lights soft in distance',
    outfit: 'formal evening dress, earrings',
    pose: 'seated in the box, leaning slightly toward viewer',
    mood: 'elevated, moved, shared',
    line: 'The music was excellent. Your shoulder next to mine was the real ticket.',
  },
  {
    id: 'hot_springs',
    title: 'Mountain inn evening',
    setting: 'mountain inn outdoor view deck at dusk, steam distant, lanterns',
    outfit: 'yukata-style or soft robe over evening wear, modest and elegant',
    pose: 'standing at the rail looking at mountains, soft profile then gaze',
    mood: 'rested, warm, private',
    line: 'A night away from everything except you.',
  },
  {
    id: 'drive_in',
    title: 'Drive-in night',
    setting: 'vintage drive-in movie under stars, car hood or blanket, screen glow',
    outfit: 'casual nice jacket, jeans, soft shirt',
    pose: 'leaning against the car, looking at viewer not the screen',
    mood: 'nostalgic, fun, close',
    line: 'I forgot the movie. I remember you laughing.',
  },
]

/** Pick a random date idea (uniform). */
export function pickDateIdea(): DateIdea {
  const i = Math.floor(Math.random() * DATE_IDEAS.length)
  return DATE_IDEAS[i]
}

/** Build image prompt from a date idea + companion appearance. */
export function buildDatePromptFromIdea(
  idea: DateIdea,
  opts: { appearance: string; name: string; race?: string }
): string {
  const look = opts.appearance.trim()
  return [
    'masterpiece illustration of an adult woman, coherent anatomy, beautiful lighting, high detail, no text, no watermark',
    'refined anime key-visual quality, cinematic',
    `Character: ${look}`,
    `Name context: ${opts.name}`,
    `Date: ${idea.title}`,
    `Outfit: ${idea.outfit}`,
    `Pose: ${idea.pose}`,
    `Setting: ${idea.setting}`,
    `expression: ${idea.mood} — not performative`,
    'romantic atmosphere, tasteful, fully clothed, soft chemistry',
    'single character focus, clear face, feminine adult proportions',
  ].join('. ')
}
