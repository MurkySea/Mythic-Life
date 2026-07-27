/**
 * Mythic Life – Geo events (pure)
 *
 * Arrive / leave / check-in at named places.
 * Continuous tracking is intentionally out of scope for the web app.
 * iOS Shortcuts + in-app buttons are the primary sources.
 */

import { type PlaceId, isValidPlaceId, getPlace } from './places'

export type GeoEventKind = 'arrive' | 'leave' | 'checkin'

export type GeoSource = 'manual' | 'shortcut' | 'browser' | 'unknown'

export interface GeoEventInput {
  place: string
  event: string
  at?: string // ISO timestamp; defaults to now
  source?: string
  lat?: number
  lng?: number
}

export interface GeoEvent {
  placeId: PlaceId
  event: GeoEventKind
  occurredAt: string // ISO
  source: GeoSource
  lat?: number
  lng?: number
}

export interface GeoParseResult {
  ok: true
  event: GeoEvent
} | {
  ok: false
  error: string
}

const VALID_EVENTS = new Set<GeoEventKind>(['arrive', 'leave', 'checkin'])
const VALID_SOURCES = new Set<GeoSource>(['manual', 'shortcut', 'browser', 'unknown'])

export function parseGeoEvent(raw: GeoEventInput, now: Date = new Date()): GeoParseResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Body must be a JSON object' }
  }

  const placeRaw = String(raw.place || '').trim().toLowerCase()
  if (!isValidPlaceId(placeRaw)) {
    return {
      ok: false,
      error: `Unknown place "${raw.place}". Valid: home, office, church, gym, lake, family`,
    }
  }

  const eventRaw = String(raw.event || '').trim().toLowerCase() as GeoEventKind
  if (!VALID_EVENTS.has(eventRaw)) {
    return {
      ok: false,
      error: `Invalid event "${raw.event}". Use arrive | leave | checkin`,
    }
  }

  const place = getPlace(placeRaw)!
  if (eventRaw === 'leave' && !place.trackLeave) {
    // Soft-accept: store as leave anyway, but callers may treat as checkin
  }

  let occurredAt = now.toISOString()
  if (raw.at) {
    const d = new Date(raw.at)
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: `Invalid at timestamp: ${raw.at}` }
    }
    occurredAt = d.toISOString()
  }

  let source: GeoSource = 'unknown'
  if (raw.source && VALID_SOURCES.has(raw.source as GeoSource)) {
    source = raw.source as GeoSource
  }

  const event: GeoEvent = {
    placeId: placeRaw,
    event: eventRaw,
    occurredAt,
    source,
  }

  if (typeof raw.lat === 'number' && typeof raw.lng === 'number') {
    event.lat = raw.lat
    event.lng = raw.lng
  }

  return { ok: true, event }
}

/** One-line companion-facing summary */
export function describeGeoEvent(ev: GeoEvent): string {
  const place = getPlace(ev.placeId)
  const label = place?.label ?? ev.placeId
  if (ev.event === 'arrive') return `Arrived at ${label}`
  if (ev.event === 'leave') return `Left ${label}`
  return `Checked in at ${label}`
}
