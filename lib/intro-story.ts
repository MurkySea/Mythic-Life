export type IntroScene = {
  id: string
  chapter: string
  title: string
  time: string
  image: string
  alt: string
  paragraphs: string[]
  quote?: string
  speaker?: string
}

export const NEW_GAME_PROLOGUE: IntroScene[] = [
  {
    id: 'found',
    chapter: 'I',
    title: 'The Girl the Worlds Would Not Keep',
    time: 'Years ago',
    image: '/story/01-found-in-the-wilds.jpg',
    alt: 'Two young adventurers meeting in a rain-dark forest, with faint living light around the silver-haired girl.',
    paragraphs: [
      'You were barely an adventurer yourself — a teenager with a secondhand blade, a borrowed pack, and more courage than coin.',
      'You found her beyond the marked road, alone beneath the trees. Silver hair. Impossible blue eyes. Pointed ears that did not quite belong to any elven people you knew. Light moved beneath her skin whenever fear took hold.',
      'She had been cast out before she understood what she was: the forbidden child of a celestial and a high fae, claimed by neither Heaven nor the Wild Courts.',
      'You did not know any of that yet. You only knew she was cold, frightened, and pretending not to be.',
    ],
    quote: 'Come on. You can stay with me until we figure this out.',
    speaker: 'You',
  },
  {
    id: 'together',
    chapter: 'II',
    title: 'Two Young Fools Against the Road',
    time: 'The years between',
    image: '/story/02-growing-together.jpg',
    alt: 'Two teenage adventurers sharing a campfire, laughing over a simple meal after a difficult day on the road.',
    paragraphs: [
      'Until became a season. Then another.',
      'You took beginner contracts and came home scraped, muddy, and proud of yourself. She learned the mortal world by walking beside you — markets, inns, guild halls, bad cooking, worse weather, and the strange human habit of pretending pain was fine if you could joke about it.',
      'You protected her when the world frightened her. She healed you when your confidence got you hurt. Somewhere along the way, taking care of her stopped being a decision and became simply what home meant.',
      'Neither of you had much. Somehow, neither of you felt poor.',
    ],
    quote: 'You know I am supposed to be the mysterious magical one, yes? Stop making me rescue you.',
    speaker: 'Seraphine',
  },
  {
    id: 'academy',
    chapter: 'III',
    title: 'The Price of Becoming',
    time: 'The first goodbye',
    image: '/story/03-academy-farewell.jpg',
    alt: 'A young adventurer and silver-haired fae-celestial girl saying goodbye at the gates of Lumenvale Academy.',
    paragraphs: [
      'Her power grew faster than either of you knew how to manage. Fae glamour tangled with celestial radiance. Flowers opened in winter. Healing light became vines of gold. Once, frightened awake from a nightmare, she filled the room with wings neither of you knew she possessed.',
      'You could keep her safe. You could not teach her what she was.',
      'So you began saving every coin the guild would spare. Better armor waited. Hot meals became cheap ones. You patched equipment that should have been replaced months earlier.',
      'When you finally had enough to send her to Lumenvale Academy, she heard the words “you have to go” before she understood everything you had sacrificed to say them.',
      'She went anyway. Angry. Afraid. Determined to make the separation worth something.',
    ],
    quote: 'Go become terrifyingly good at this magic thing. I will become a real adventurer before you get back.',
    speaker: 'You',
  },
  {
    id: 'apart',
    chapter: 'IV',
    title: 'Separate Roads',
    time: 'Years apart',
    image: '/story/04-separate-roads.jpg',
    alt: 'A split scene showing a lone adventurer on a mountain road and a silver-haired mage studying living celestial-fae magic at Lumenvale Academy.',
    paragraphs: [
      'You kept your promise. Contract by contract, you became the adventurer you used to pretend you already were.',
      'At Lumenvale Academy, Seraphine discovered that every teacher wanted to solve her by removing half of her. Celestial masters told her to discipline the wild magic. Fae scholars told her to stop letting Heaven cage it.',
      'Eventually she stopped asking either side for permission.',
      'Her breakthrough was neither celestial nor fae. Living radiance: golden light that grew, healed, bloomed, and chose its own shape. For the first time, she was not an imperfect version of two peoples. She was whole.',
      'And being whole forced her to ask a harder question: when she thought of home, why did she always think of you?',
    ],
  },
  {
    id: 'return',
    chapter: 'V',
    title: 'You Are Late',
    time: 'Today',
    image: '/story/05-the-return.jpg',
    alt: 'An adult silver-haired celestial-fae mage waiting outside a small adventurer home at golden hour with her travel bags.',
    paragraphs: [
      'You return from a routine contract expecting an empty house and a quiet meal.',
      'Someone is sitting beside your door with several travel bags, an academy cloak folded over one arm, and long platinum-silver hair catching the late afternoon sun.',
      'You recognize her immediately. Your mind simply takes a moment to reconcile the girl you sent away with the woman looking back at you.',
      'She notices the staring. Of course she notices.',
    ],
    quote: 'You are late.',
    speaker: 'Seraphine',
  },
  {
    id: 'choice',
    chapter: 'VI',
    title: 'Beside You',
    time: 'The promise renewed',
    image: '/story/06-beside-you.jpg',
    alt: 'Two adult adventurers standing together at a table covered in maps, preparing for a shared journey.',
    paragraphs: [
      'You assume she is visiting. She lets you believe that for almost an hour.',
      'Then you realize the bags contain everything she owns.',
      'She did not return because the academy released her. She did not return because she needs rescuing. She had a life there — friends, rivals, mentors, choices that belonged only to her.',
      'She came back after learning who she was without you.',
      'Now she wants something neither of you has ever tried before: not to follow behind you, and not to be protected from the road, but to choose it with you.',
    ],
    quote: 'I know how to stand on my own now. I would rather stand beside you. I am coming with you.',
    speaker: 'Seraphine',
  },
  {
    id: 'begin',
    chapter: 'VII',
    title: 'Mythic Life',
    time: 'The journey begins',
    image: '/story/07-first-quest.jpg',
    alt: 'Two adult adventurers leaving home together at sunrise, a road stretching toward distant mountains and an enchanted horizon.',
    paragraphs: [
      'Your history is already written: two young people who became home for each other, then became themselves apart.',
      'What happens next is not.',
      'The trust between you is old. The closeness is real. What that closeness will become — friendship, family, partnership, love, or something neither of you has named yet — can only be discovered by living it.',
      'Real quests will become the road. Habits will become training. Goals will become destinations. The life you build outside this world will decide who the two of you become inside it.',
    ],
    quote: 'So... where are we going first?',
    speaker: 'Seraphine',
  },
]
