export type WorldEventKind =
  | 'chest'
  | 'companion_interaction'
  | 'merchant'
  | 'encounter'
  | 'resource_discovery'
  | 'lore_reveal'

export type RecentWorldEvent = { kind: WorldEventKind; occurredAt: string }

export const EVENT_CONFIG = {
  triggerChance: 0.28,
  cooldownHours: 8,
  repeatWindowHours: 72,
  weights: {
    chest: 28,
    companion_interaction: 24,
    merchant: 10,
    encounter: 14,
    resource_discovery: 16,
    lore_reveal: 8,
  } satisfies Record<WorldEventKind, number>,
}

export function selectWorldEvent(input: {
  recentEvents: RecentWorldEvent[]
  now: Date
  random?: () => number
}): WorldEventKind | null {
  const random = input.random ?? Math.random
  const last = input.recentEvents
    .map((event) => new Date(event.occurredAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0]
  if (last && input.now.getTime() - last < EVENT_CONFIG.cooldownHours * 3_600_000) {
    return null
  }
  if (random() >= EVENT_CONFIG.triggerChance) return null

  const repeatCutoff = input.now.getTime() - EVENT_CONFIG.repeatWindowHours * 3_600_000
  const recentlySeen = new Set(
    input.recentEvents
      .filter((event) => new Date(event.occurredAt).getTime() >= repeatCutoff)
      .map((event) => event.kind),
  )
  const eligible = Object.entries(EVENT_CONFIG.weights)
    .filter(([kind]) => !recentlySeen.has(kind as WorldEventKind)) as Array<[WorldEventKind, number]>
  const pool = eligible.length > 0
    ? eligible
    : Object.entries(EVENT_CONFIG.weights) as Array<[WorldEventKind, number]>
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = random() * total
  for (const [kind, weight] of pool) {
    roll -= weight
    if (roll <= 0) return kind
  }
  return pool[pool.length - 1][0]
}
