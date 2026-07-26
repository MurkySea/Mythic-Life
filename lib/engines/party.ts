/**
 * Mythic Life – Active Party (max 5)
 * Pure functions. The full roster stays unlimited; only the active party
 * receives Trust updates, dialogue priority, and daily effects.
 *
 * Design finalized 2026-07-25.
 */

export const MAX_PARTY_SIZE = 5

export interface PartyMember {
  /** Companion slug */
  slug: string
  /** Whether this member is the designated Leader */
  isLeader: boolean
  /** When they joined the active party (ISO) */
  joinedAt: string
}

export interface PartyState {
  members: PartyMember[]
  /** Optional soft lock – when true, join/leave requires explicit unlock */
  locked: boolean
}

export function createEmptyParty(): PartyState {
  return { members: [], locked: false }
}

export function partySize(party: PartyState): number {
  return party.members.length
}

export function isFull(party: PartyState): boolean {
  return party.members.length >= MAX_PARTY_SIZE
}

export function hasMember(party: PartyState, slug: string): boolean {
  return party.members.some((m) => m.slug === slug)
}

export function getLeader(party: PartyState): PartyMember | null {
  return party.members.find((m) => m.isLeader) ?? null
}

/**
 * Add a companion to the active party.
 * Returns null if the party is full, already contains the slug, or is locked.
 * First member automatically becomes Leader.
 */
export function joinParty(
  party: PartyState,
  slug: string,
  now: Date = new Date()
): PartyState | null {
  if (party.locked) return null
  if (isFull(party)) return null
  if (hasMember(party, slug)) return null

  const isFirst = party.members.length === 0
  const member: PartyMember = {
    slug,
    isLeader: isFirst,
    joinedAt: now.toISOString(),
  }

  return {
    ...party,
    members: [...party.members, member],
  }
}

/**
 * Remove a companion from the active party.
 * If the Leader leaves and others remain, the earliest-joined member becomes Leader.
 * Returns null if locked or the slug is not present.
 */
export function leaveParty(party: PartyState, slug: string): PartyState | null {
  if (party.locked) return null
  if (!hasMember(party, slug)) return null

  const remaining = party.members.filter((m) => m.slug !== slug)

  if (remaining.length === 0) {
    return { members: [], locked: party.locked }
  }

  // Ensure exactly one Leader
  const hadLeader = remaining.some((m) => m.isLeader)
  if (!hadLeader) {
    // Promote the earliest-joined
    const sorted = [...remaining].sort(
      (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
    )
    sorted[0] = { ...sorted[0], isLeader: true }
    return { ...party, members: sorted }
  }

  return { ...party, members: remaining }
}

/**
 * Designate a new Leader. The previous Leader is demoted.
 * Returns null if the slug is not in the party.
 */
export function setLeader(party: PartyState, slug: string): PartyState | null {
  if (!hasMember(party, slug)) return null

  return {
    ...party,
    members: party.members.map((m) => ({
      ...m,
      isLeader: m.slug === slug,
    })),
  }
}

/**
 * Swap two members’ positions (order only; leadership unchanged).
 * Useful for UI reordering.
 */
export function reorderParty(
  party: PartyState,
  fromIndex: number,
  toIndex: number
): PartyState | null {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= party.members.length ||
    toIndex >= party.members.length
  ) {
    return null
  }

  const members = [...party.members]
  const [moved] = members.splice(fromIndex, 1)
  members.splice(toIndex, 0, moved)

  return { ...party, members }
}

/**
 * Soft-lock / unlock the party (prevents accidental join/leave).
 */
export function setPartyLocked(party: PartyState, locked: boolean): PartyState {
  return { ...party, locked }
}

/**
 * Validate that the party is internally consistent
 * (exactly 0 or 1 Leader, size ≤ MAX, no duplicate slugs).
 */
export function validateParty(party: PartyState): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (party.members.length > MAX_PARTY_SIZE) {
    errors.push(`Party exceeds max size of ${MAX_PARTY_SIZE}`)
  }

  const slugs = party.members.map((m) => m.slug)
  if (new Set(slugs).size !== slugs.length) {
    errors.push('Duplicate companion slugs in party')
  }

  const leaders = party.members.filter((m) => m.isLeader)
  if (party.members.length > 0 && leaders.length !== 1) {
    errors.push(`Expected exactly 1 Leader, found ${leaders.length}`)
  }

  return { valid: errors.length === 0, errors }
}
