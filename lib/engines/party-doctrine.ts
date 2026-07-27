/**
 * Mythic Life – Isekai Party Doctrine
 *
 * Companions are not unlockable dates. They are people who notice you,
 * watch how you lead, and only after respect is earned do they *choose*
 * to follow. Active Party (max 5) is the living harem-party unit.
 *
 * Founding companion = Raphtalia-class: loyalty earned through protection
 * and consistency, with optional light Aqua-register banter later.
 *
 * Layers implemented here:
 *   1. Party reacts as a unit (shared mood + one voice / short chorus)
 *   2. Named cross-talk (stance tags + canned reference lines)
 *
 * Pure functions only. Wire into outreach / messages at the boundary.
 */

import type { PartyState } from './party'
import { getLeader } from './party'

// ─── Respect → Follow stages ────────────────────────────────

export type FollowStage =
  | 'noticed'   // exists in the world; rare lines
  | 'watched'   // comments on real life signal
  | 'respected' // Trust threshold; may offer to join
  | 'followed'  // active Party member

/**
 * Map affinity + party membership → narrative stage.
 * Thresholds are soft; tune later without rewriting copy.
 */
export function followStage(
  affinity: number,
  inActiveParty: boolean
): FollowStage {
  if (inActiveParty) return 'followed'
  if (affinity >= 8) return 'respected'
  if (affinity >= 3) return 'watched'
  return 'noticed'
}

export const FOLLOW_STAGE_LABEL: Record<FollowStage, string> = {
  noticed: 'Noticed',
  watched: 'Watching',
  respected: 'Respects you',
  followed: 'Follows you',
}

/** Short beat when someone first joins the active party */
export function joinFollowBeat(name: string, isFounder: boolean): string {
  if (isFounder) {
    return `${name} does not ask permission. She has already decided: she will walk with you.`
  }
  return `${name} meets your eyes and chooses the road. "I'll follow." Not a contract — a decision.`
}

// ─── Founding companion ─────────────────────────────────────

export const FOUNDING_SLUG = 'seraphine'

export function isFoundingCompanion(slug: string): boolean {
  return slug === FOUNDING_SLUG
}

/**
 * Doctrine text for prompts / UI — Raphtalia-class founder.
 */
export const FOUNDING_DOCTRINE = {
  archetype: 'Raphtalia-class founder',
  core:
    'She watched who returned after they promised. Loyalty is earned, not summoned. Once she follows, she speaks for the party when the leader is silent.',
  unlockTone:
    'I have been watching. I will stay. Not because you are perfect — because you keep coming back.',
  partyRole:
    'First believer. Protective of the party. Will challenge Mark if the party is neglected.',
}

// ─── Party mood (unit layer) ────────────────────────────────

export type PartyMood =
  | 'proud'      // strong recent leadership
  | 'steady'     // normal good standing
  | 'uneasy'     // mixed signal / mild debt
  | 'strained'   // poor rhythm / high shadow
  | 'fractured'  // bad streak; trust damaged

export interface PartyMoodInput {
  /** Recent Rhythm / personal tier label if known */
  recentTier?: 'Excellent' | 'Good' | 'Neutral' | 'Poor' | 'Bad'
  /** Optional Leader Trust 0–100-ish */
  leaderTrust?: number
  /** Shadow debt if tracked */
  shadowDebt?: number
}

export function partyMoodFromSignals(input: PartyMoodInput): PartyMood {
  const tier = input.recentTier
  const trust = input.leaderTrust
  const debt = input.shadowDebt ?? 0

  if (tier === 'Bad' || (trust != null && trust < 25) || debt >= 15) {
    return 'fractured'
  }
  if (tier === 'Poor' || (trust != null && trust < 45) || debt >= 8) {
    return 'strained'
  }
  if (tier === 'Neutral' || debt >= 3) {
    return 'uneasy'
  }
  if (tier === 'Excellent' || (trust != null && trust >= 75)) {
    return 'proud'
  }
  return 'steady'
}

/** Unit reaction seeds — one voice or short chorus. Speaker prefers Leader, else founder, else first member. */
export function pickPartySpeaker(
  party: PartyState,
  preferSlug?: string
): string | null {
  if (party.members.length === 0) return null
  if (preferSlug && party.members.some((m) => m.slug === preferSlug)) {
    return preferSlug
  }
  const leader = getLeader(party)
  if (leader) return leader.slug
  const founder = party.members.find((m) => m.slug === FOUNDING_SLUG)
  if (founder) return founder.slug
  return party.members[0].slug
}

export interface UnitReaction {
  mood: PartyMood
  speakerSlug: string | null
  /** Prompt seed for companion voice / outreach */
  seed: string
  /** Optional second voice for light chorus */
  secondarySeed?: string
}

const UNIT_SEEDS: Record<PartyMood, string[]> = {
  proud: [
    'The party felt the day land clean. Someone should say it out loud — without turning it into a report.',
    'Respect moves through the group when the leader keeps his word. A short, in-character acknowledgment from the party.',
    'They exchange a look that means: he held the line. One of them speaks for the rest.',
  ],
  steady: [
    'Ordinary faithfulness. The party does not cheer — they stay. One quiet line of presence.',
    'No crisis. No parade. A companion notes that the road is still being walked.',
  ],
  uneasy: [
    'Something in the rhythm slipped. Not a lecture — a watchful check-in from the party.',
    'They noticed. One of them asks without accusing.',
  ],
  strained: [
    'The party feels the strain. The founding tone is protective, not cruel. Name the gap without shaming.',
    'Trust is thinner today. A party member speaks carefully: she is still here, and she is not blind.',
  ],
  fractured: [
    'The party is hurt. Someone who follows him says so without leaving. Respect requires honesty.',
    'Silence would be worse. One voice from the party: we follow a leader who returns — so return.',
  ],
}

export function buildUnitReaction(
  party: PartyState,
  input: PartyMoodInput,
  preferSlug?: string
): UnitReaction {
  const mood = partyMoodFromSignals(input)
  const speakerSlug = pickPartySpeaker(party, preferSlug)
  const pool = UNIT_SEEDS[mood]
  const seed = pool[Math.floor(Math.random() * pool.length)]

  let secondarySeed: string | undefined
  if (party.members.length >= 2 && (mood === 'proud' || mood === 'fractured')) {
    secondarySeed =
      mood === 'proud'
        ? 'A second party member adds a brief, different-flavored agreement — not a pile-on.'
        : 'Another party member does not contradict. She stays in frame, quiet, present.'
  }

  return { mood, speakerSlug, seed, secondarySeed }
}

// ─── Stance map + cross-talk (layer 2) ──────────────────────

export type StanceTag =
  | 'founder'      // speaks for party, protective
  | 'challenger'   // tests the leader, teases soft comfort
  | 'mediator'     // softens conflict
  | 'devotee'      // high loyalty, low friction
  | 'observer'     // quiet, evidence-based
  | 'spark'        // energy, humor, risk of avoidance

/** Default stance by slug — extend as roster grows */
export const STANCE_BY_SLUG: Record<string, StanceTag> = {
  seraphine: 'founder',
  kira_foxveil: 'devotee',
  ember_crimsonfall: 'challenger',
  nyx_voidbane: 'observer',
  mira_quillweave: 'observer',
  lyra_dawnforge: 'mediator',
  kael_ashrunner: 'spark',
  selene_tideglass: 'mediator',
  iris_bellweather: 'spark',
  seris_nightthorn: 'challenger',
  rowan_ironmane: 'founder',
  elias_stillwater: 'mediator',
  bramble_mossheart: 'devotee',
  orion_halovard: 'observer',
  gideon_brasswake: 'observer',
  aster_chrona: 'observer',
  vesper_nocturne: 'challenger',
}

export function stanceOf(slug: string): StanceTag {
  return STANCE_BY_SLUG[slug] ?? 'devotee'
}

/** How A tends to reference B in dialogue (prompt spice, not a sim) */
export function crossTalkHint(speakerSlug: string, aboutSlug: string): string | null {
  if (speakerSlug === aboutSlug) return null
  const a = stanceOf(speakerSlug)
  const b = stanceOf(aboutSlug)

  if (a === 'founder' && b === 'challenger') {
    return `May briefly note ${aboutSlug}'s fire without shutting it down — protective of party unity.`
  }
  if (a === 'challenger' && b === 'founder') {
    return `May needle the founder lightly (loyalty vs softness) then return focus to Mark.`
  }
  if (a === 'mediator') {
    return `May smooth a rough edge if another party member was sharp — one sentence max.`
  }
  if (a === 'spark' && b === 'observer') {
    return `May tease the quieter one into the moment, then drop it.`
  }
  if (a === 'observer') {
    return `Rarely name-drops others; if she does, it is factual, not gossipy.`
  }
  return `May reference another party member only if it serves Mark's moment — never a side soap opera.`
}

/**
 * Build a small system blurb for prompt injection when generating party-aware dialogue.
 */
export function partyContextBlurb(
  party: PartyState,
  mood: PartyMood,
  speakerSlug: string
): string {
  const names = party.members.map((m) => m.slug).join(', ')
  const leader = getLeader(party)
  const lines = [
    `Active party (${party.members.length}/5): ${names || 'empty'}.`,
    leader ? `Party leader companion: ${leader.slug}.` : 'No party leader set.',
    `Party mood: ${mood}.`,
    `Speaker: ${speakerSlug}. Stance: ${stanceOf(speakerSlug)}.`,
    isFoundingCompanion(speakerSlug)
      ? FOUNDING_DOCTRINE.partyRole
      : 'She follows because respect was earned; she is not a menu unlock.',
    'If another party member is referenced, keep it to one beat. No independent companion subplot.',
  ]
  return lines.join(' ')
}

// ─── Event hooks (place / rhythm) ───────────────────────────

export type LifeSignalKind =
  | 'place_arrive'
  | 'place_leave'
  | 'rhythm_good'
  | 'rhythm_bad'
  | 'streak'

/** Extra seed flavor when life signal is known */
export function lifeSignalSeed(
  kind: LifeSignalKind,
  detail?: string
): string {
  switch (kind) {
    case 'place_arrive':
      return `The party registers arrival${detail ? ` at ${detail}` : ''}. Presence, not a status report.`
    case 'place_leave':
      return `The party registers departure${detail ? ` from ${detail}` : ''}. Meaning depends on time and pattern.`
    case 'rhythm_good':
      return 'Sleep and return were kept. Respect ticks up in the party without a speech.'
    case 'rhythm_bad':
      return 'The night or the return slipped. The party notices. Honesty over cheer.'
    case 'streak':
      return 'Consistency is stacking. Someone who follows him should feel it.'
    default:
      return 'The party is paying attention.'
  }
}
