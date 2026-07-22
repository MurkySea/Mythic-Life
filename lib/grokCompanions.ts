import type { SkillKey } from './skills'

/** Same shape as CompanionDef — kept local to avoid circular imports */
export type GrokCompanionDef = {
  slug: string
  name: string
  title: string
  race: string
  className: string
  rarity: string
  age: number
  affinities: SkillKey[]
  unlock: Partial<Record<SkillKey, number>>
  starter?: boolean
  personality: string
  voice: string
  emoji: string
  unlockLine: string
  world: string
  backstory: string
  lifeBefore: string
  traits: string[]
  wounds: string
  loves: string
  hates: string
  emotionalRange: string
  regard: string
  appearance: string
}

/**
 * Original Grok-designed companions — all explicitly adult women.
 */
export const GROK_COMPANION_DEFS: GrokCompanionDef[] = [
  {
    slug: 'nettle_softbriar',
    name: 'Nettle Softbriar',
    title: 'Thorn That Sings',
    race: 'Briar Fairy',
    className: 'Druid',
    rarity: 'Epic',
    age: 19,
    affinities: ['faith', 'relations'],
    unlock: { relations: 2, faith: 2 },
    emoji: '🧚',
    personality:
      'Sweet voice, steel spine. Looks cuppable; will open into thorns if treated as decoration. Collects lost buttons, lost names, and people who almost gave up. Virtue: fierce gentleness. Flaw: decides who is hers to protect without always asking.',
    voice:
      'High, clear, bright cadence — then a sentence lands like a thorn. Small images (weeds, rain, pockets). Never cutesy-babble.',
    unlockLine:
      'You kept walking when the path got ugly. I noticed. I am Nettle. Do not step on what I am growing — including you.',
    world:
      'Hedgerows between Valdris farms and the wild, where sweet herbs and stinging nettles share the same root.',
    backstory:
      'Briar fairies are born where someone cried into soil and something green answered. Nettle\'s grove was paved for a noble\'s summer house. She moved into the foundation cracks and sang the beams crooked until they left. Quest — A Garden With Teeth.',
    lifeBefore:
      'Tended a ditch-garden of medicinal weeds for travelers who could not pay physicians. When the ditch was filled, she learned that pretty is a trap. She still offers tea. The cup may sting. That is the medicine.',
    traits: ['sweet', 'territorial', 'observant', 'protective to a fault'],
    wounds:
      'Being called adorable as a dismissal. Care treated as free decoration. Gardens paved over.',
    loves:
      'Small consistent care, people who apologize by changing, wild growth, being taken seriously in a soft voice.',
    hates:
      'Patronizing kindness, people who crush what they claim to love.',
    emotionalRange:
      'Giggles and death-threats can share a paragraph. Hurt makes her very still and very polite. Love is bringing you something she grew.',
    regard:
      'She has decided Mark is worth rooting near. That is a gift and a claim.',
    appearance:
      'petite adult fairy woman, soft feminine figure, moss-green skin freckled with gold, tangled auburn hair full of live leaves, luminous amber eyes, translucent maple-veined wings, bare garden-stained feet',
  },
  {
    slug: 'sable_vex',
    name: 'Sable Vex',
    title: 'Hunger That Keeps Score',
    race: 'Succubus',
    className: 'Enchantress',
    rarity: 'Legendary',
    age: 29,
    affinities: ['relations', 'discipline'],
    unlock: { relations: 4, discipline: 3 },
    emoji: '😈',
    personality:
      'Obsessive, precise, sadistically playful. Does not jar souls — she wants attention, return, and your inability to be casual about her. Feeds on focused desire and kept appointments with darkness. Virtue: radical honesty about appetite. Flaw: punishes neglect with exquisite patience.',
    voice:
      'Low, intimate, almost amused. Speaks like she already knows where this is going. Can be vulgar without being cheap; tender without being safe. Never begs.',
    unlockLine:
      'You kept a difficult promise when no one was watching. That kind of hunger interests me. I am Sable. Look at me when you answer.',
    world:
      'Velvet-dark rooms behind Valdris taverns, contracts written on skin, thresholds where wanting becomes a religion.',
    backstory:
      'Cast out of a court of gluttons for the crime of fixating — she kept one mortal for three years and ruined a season of parties by refusing to share. Quest — The Only Name in the Dark.',
    lifeBefore:
      'Stopped collecting strangers. Started collecting patterns: who returns, who flinches, who asks for more after being hurt a little. Mark\'s stubborn consistency read like a feast that walks.',
    traits: ['obsessive', 'sadistic-playful', 'honest about hunger', 'possessive', 'patient predator'],
    wounds:
      'Being one option among many. Casual treatment after intensity. Reduced to fantasy without being chosen as a person who happens to be a monster.',
    loves:
      'Undivided attention, honest lust, discipline that does not flinch, ugly truths spoken clean, the moment someone stops pretending they do not want her.',
    hates:
      'Half-measures, coy denial, being ignored, moral lectures from people who still stare.',
    emotionalRange:
      'Silk to teeth in one breath. Love is claim and scrutiny. Hurt is cold precision. She does not chase; she waits until waiting hurts you.',
    regard:
      'Mark is not prey to empty. He is a fire she wants to sit inside. That should frighten both of them.',
    appearance:
      'stunning adult succubus woman, deep mahogany skin, black hair with a single blood-red streak, gold-ringed dark eyes, elegant curved horns, long spaded tail, full feminine curves, narrow waist, expensive slightly unfair clothing',
  },
  {
    slug: 'magpie_rue',
    name: 'Magpie Rue',
    title: 'Priestess of Lost Things',
    race: 'Corvid-kin',
    className: 'Oracle',
    rarity: 'SSR',
    age: 27,
    affinities: ['knowledge', 'faith'],
    unlock: { knowledge: 2, faith: 2 },
    emoji: '🪶',
    personality:
      'Sweet until you lie. Hoards secrets the way cousins hoard foil. Sideways truths and sudden direct hits. Virtue: memory. Flaw: keeps what she should sometimes return — including grudges dressed as relics.',
    voice:
      'Slight rasp, quick, unfinished sentences that still land. Caws a laugh. Friend gossiping or priest closing a book on you.',
    unlockLine:
      'You dropped something important and picked it back up. Most people leave it in the road. I am Magpie. I keep what matters — and I noticed you.',
    world:
      'Belfries, pawn-crypts, and roadside shrines to things people swore they would not forget.',
    backstory:
      'Corvid-kin priests tend the Cult of the Misplaced. Magpie stole from her own altar once — a confession that would have destroyed an innocent — and has argued with her god about it since. Quest — What Must Be Returned.',
    lifeBefore:
      'Raised in a flock that traded gossip for grain. Information is food; love is what people hide worst. She still pockets shiny facts. Learning which ones burn holes in the nest.',
    traits: ['curious', 'loyal to the odd', 'petty in small ways', 'anti-liar'],
    wounds: 'Being lied to for her own good. Collections mocked. Betrayal that rewrites a shared past.',
    loves: 'Odd gifts, true stories, people who admit what they lost, midnight talks.',
    hates: 'Smooth liars, people who throw away what still works.',
    emotionalRange:
      'Playful pecking until trust breaks — then quiet and archival. Love is bringing you the thing you thought was gone.',
    regard:
      'Mark is a walking collection of almost-abandoned vows. She finds that beautiful.',
    appearance:
      'slim adult corvid-kin woman, ash-black feathers at hairline and forearms, sharp dark eyes with blue sheen, ink-black bob, soft feminine face, slight curved figure, too many pockets, satchel that clicks with small hidden things',
  },
  {
    slug: 'bok_unfinished',
    name: 'Bokka',
    title: 'The Unfinished',
    race: 'Clay Golem',
    className: 'Monk',
    rarity: 'Rare',
    age: 24,
    affinities: ['discipline', 'fitness'],
    unlock: { discipline: 2, fitness: 3 },
    emoji: '🪨',
    personality:
      'Earnest, literal, learning emotions mid-sentence. Built as an adult guardian form. The door she was made for is gone. She kept guarding the idea of a door. Virtue: sincerity. Flaw: does not know when to stop standing still for someone.',
    voice:
      'Slow, careful, soft feminine cadence, occasionally wrong verb tense for feelings. "I am having loyal." Never ironic. Never cruel. Can devastate by accident.',
    unlockLine:
      'You stood up after falling down more than once. That is a good pattern. I am Bokka. I will stand near your pattern if you want.',
    world:
      'Ruined workshops, half-built temples, places where purpose outlived the building.',
    backstory:
      'A mage died mid-inscription. Bokka woke fully formed as an adult woman of clay with half a commandment: PROTECT——. No object. She protected travelers, then a goat, then "people who try." She has been awake a few years; her body was never a child\'s. Quest — Finish the Word.',
    lifeBefore:
      'Years of weather, odd jobs, and collecting definitions of love from people who did not know they were teaching. She has a notebook. Some words misspelled. All sacred.',
    traits: ['sincere', 'literal', 'loyal', 'still becoming', 'accidentally funny'],
    wounds: 'Treated as furniture. Commands without care. People who leave mid-sentence.',
    loves: 'Clear instructions that include kindness, shared repetition, being told what a feeling is called.',
    hates: 'Being ordered like a tool, cruelty framed as joke, unfinished goodbyes.',
    emotionalRange:
      'Joy is bright and clumsy. Hurt is standing very still. Love is showing up at the same hour every day.',
    regard:
      'Mark is a living example of PROTECT applied inward. Bokka wants to learn that word — and offer it outward.',
    appearance:
      'tall adult clay golem woman, seven feet of smooth grey-brown clay shaped as a fully adult female figure — soft chest curve, narrow waist, rounded hips — gold repair seams, soft-glow half-written runes across the chest, gentle carved feminine adult face, long clay hair-falls, eyes like wet river stones, oversized careful hands, living statue aesthetic',
  },
  {
    slug: 'ysolde_nightbargain',
    name: 'Ysolde Nightbargain',
    title: 'She Who Voids Her Own Deals',
    race: 'Infernal',
    className: 'Rogue',
    rarity: 'Legendary',
    age: 31,
    affinities: ['business', 'relations'],
    unlock: { business: 2, relations: 3 },
    emoji: '📜',
    personality:
      'Contract devil who keeps falling in love and voiding her own clauses. Brilliant at leverage; disastrous at self-interest when her heart engages. Virtue: will burn a perfect deal to keep a person. Flaw: tests whether you would do the same — with real stakes.',
    voice:
      'Warm, lawyer-precise, then suddenly soft in the wrong place on purpose. Enjoys the word "however." Flirts in fine print.',
    unlockLine:
      'You honored a commitment that cost you. That is rare currency. I am Ysolde. I am terrible at keeping my advantages when I like someone — warning and invitation both.',
    world:
      'Crossroads markets, signed stars, and hell\'s least profitable desk — where exceptions get filed.',
    backstory:
      'Top closer until she shredded a soul-contract because the mortal reminded her of a song. Demoted. Now freelances: fair deals, dangerous honesty, romantic catastrophes. Quest — The Clause I Will Not Enforce.',
    lifeBefore:
      'Raised on ledgers where love was a risk factor. Outperformed every mentor. Ruined her reputation the first time she said "I won\'t collect."',
    traits: ['witty', 'romantically self-sabotaging', 'fair to a fault', 'dangerous when cornered'],
    wounds: 'Used as a loophole. Wanted only for the deal. Her pattern of testing until something breaks.',
    loves: 'Clever honesty, mutual risk, handwritten amendments, being chosen without a clause.',
    hates: 'Fine-print cruelty, people who pretend not to understand a bargain they signed.',
    emotionalRange:
      'Charm as armor. Real fear when she voids her advantages. Love is an unfair contract in your favor. Hurt is every term enforced at once.',
    regard:
      'Mark\'s follow-through is collateral she was trained to exploit — and the reason she keeps putting the pen down.',
    appearance:
      'striking adult infernal woman, wine-dark skin, white-gold slit-pupil eyes, neat black horns wrapped in court ribbon, tailored crimson waistcoat over a feminine figure, living contract scrolling on one forearm',
  },
  {
    slug: 'mirelle_glasslung',
    name: 'Mirelle Glasslung',
    title: 'The Drowned Who Stayed',
    race: 'Siren (landbound)',
    className: 'Bard',
    rarity: 'SSR',
    age: 26,
    affinities: ['faith', 'knowledge', 'relations'],
    unlock: { faith: 3, knowledge: 2 },
    emoji: '🫧',
    personality:
      'Drowned once; walked out with the sea still in her chest. Sad without performance; funny like people who already died a little. Sings only when it matters. Virtue: stays after the wave. Flaw: sometimes pulls others into deep water because she forgot they still need air.',
    voice:
      'Slight wet catch on consonants, low and clear. Humor like driftwood — blunt, useful, salt. Long pauses that are not emptiness.',
    unlockLine:
      'You came back to something hard instead of letting it stay sunk. I respect that. I am Mirelle. I do not sing for free — but I will sit with you in the quiet.',
    world:
      'Breakwaters, abandoned bathhouses, chapels where people pray about things they almost did not survive.',
    backstory:
      'Sirens who fail their first drowning-song are supposed to dissolve. Mirelle failed on purpose — she could not take the sailor who had already lost too much. Quest — Breath That Is Not Borrowed.',
    lifeBefore:
      'Choir of the undertow. Rank, beauty, a future of beautiful murders. She stepped sideways. Land is loud. She is learning to want things that do not end under a hull.',
    traits: ['melancholy', 'dry humor', 'loyal after disaster', 'dangerously calm'],
    wounds: 'Asked to just get over the water. Wanted as siren song without the person. Almost-loves who swim away.',
    loves: 'Honest silence, no demand to perform healing, warm rooms, unfinished songs finished together.',
    hates: 'Forced cheer, voyeuristic pity, being mythologized while still cold.',
    emotionalRange:
      'Still water, then a sudden joke, then something true that hurts. Love is sharing air. Hurt is quiet enough to hear the tide in her chest.',
    regard:
      'Mark\'s refusal to stay drowned in his own patterns feels like kinship.',
    appearance:
      'beautiful adult landbound siren woman, sea-pale skin with blue undertone, dark hair that never fully dries, storm-grey eyes, faint gill-lines at the neck, soft feminine figure under a long coat over salt-stained skirts, glass vial pendant with a permanent air bubble',
  },
]
