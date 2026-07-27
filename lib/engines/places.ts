/**
 * Mythic Life – Named Places (Mark)
 *
 * High-signal locations only. Not continuous GPS.
 * Used by geo ingest, check-in UI, and eventually companion reactions.
 */

export type PlaceId =
  | 'home'
  | 'office'
  | 'church'
  | 'gym'
  | 'lake'
  | 'family'

export interface PlaceDef {
  id: PlaceId
  label: string
  emoji: string
  /** Short line companions can reference */
  vibe: string
  /** Whether arrive/leave both matter */
  trackLeave: boolean
}

export const PLACES: Record<PlaceId, PlaceDef> = {
  home: {
    id: 'home',
    label: 'Home',
    emoji: '🏠',
    vibe: 'sanctuary, evening protection, Lauren',
    trackLeave: true,
  },
  office: {
    id: 'office',
    label: 'Office',
    emoji: '💼',
    vibe: 'Edward Jones, stewardship work, clients',
    trackLeave: true,
  },
  church: {
    id: 'church',
    label: 'Church',
    emoji: '✝️',
    vibe: 'worship, Bible study, community',
    trackLeave: false,
  },
  gym: {
    id: 'gym',
    label: 'Gym / Walk',
    emoji: '💪',
    vibe: 'body as temple, movement',
    trackLeave: false,
  },
  lake: {
    id: 'lake',
    label: 'Lake / Fishing',
    emoji: '🎣',
    vibe: 'stillness, hobby, recharge',
    trackLeave: false,
  },
  family: {
    id: 'family',
    label: 'Family',
    emoji: '👨‍👩‍👧',
    vibe: 'in-laws, kin, shared table',
    trackLeave: false,
  },
}

export const PLACE_LIST: PlaceDef[] = Object.values(PLACES)

export function getPlace(id: string): PlaceDef | undefined {
  return PLACES[id as PlaceId]
}

export function isValidPlaceId(id: string): id is PlaceId {
  return id in PLACES
}
