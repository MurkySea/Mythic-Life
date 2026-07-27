/**
 * Today surface lanes
 *
 * Routine   — recurring tasks scheduled for today (daily / weekly)
 * Must-do   — up to 5 intentional focus slots (must_do flag, or is_today one-offs)
 * Master    — other open one-time tasks (backlog / overflow)
 */

export type TaskRow = {
  id: string
  title: string
  notes?: string | null
  is_today?: boolean | null
  is_completed?: boolean | null
  recurrence?: string | null
  weekdays?: string | null
  anchor_time?: string | null
  streak_count?: number | null
  must_do?: boolean | null
  domains?: string | null
  domain?: string | null
}

export const MUST_DO_CAP = 5

export function isRecurring(task: TaskRow): boolean {
  const r = (task.recurrence || 'none').toLowerCase()
  return r === 'daily' || r === 'weekly'
}

export function isOneTime(task: TaskRow): boolean {
  return !isRecurring(task)
}

/**
 * Split incomplete tasks into the three Today lanes.
 *
 * Must-do preference order:
 *  1. Explicit must_do = true
 *  2. One-time tasks already flagged is_today (planning “pull to today”)
 * Cap at MUST_DO_CAP. Overflow one-time goes to Master list.
 */
export function splitTaskLanes(tasks: TaskRow[]): {
  routine: TaskRow[]
  mustDos: TaskRow[]
  master: TaskRow[]
} {
  const open = tasks.filter((t) => !t.is_completed)

  const routine = open
    .filter((t) => isRecurring(t) && t.is_today)
    .slice()
    .sort(byAnchor)

  const oneTime = open.filter((t) => isOneTime(t))

  // Explicit must-dos first
  const explicit = oneTime.filter((t) => t.must_do === true)
  const todayOneOffs = oneTime.filter((t) => t.must_do !== true && t.is_today)
  const backlog = oneTime.filter((t) => t.must_do !== true && !t.is_today)

  const mustDos: TaskRow[] = []
  for (const t of [...explicit, ...todayOneOffs]) {
    if (mustDos.length >= MUST_DO_CAP) break
    mustDos.push(t)
  }

  const mustDoIds = new Set(mustDos.map((t) => t.id))
  const master = [...explicit, ...todayOneOffs, ...backlog]
    .filter((t) => !mustDoIds.has(t.id))
    .sort(byCreatedDesc)

  return { routine, mustDos, master }
}

function byAnchor(a: TaskRow, b: TaskRow): number {
  const ta = anchorMinutes(a.anchor_time)
  const tb = anchorMinutes(b.anchor_time)
  if (ta !== tb) return ta - tb
  return 0
}

function byCreatedDesc(a: TaskRow, b: TaskRow): number {
  // stable enough without created_at on the type
  return String(b.id).localeCompare(String(a.id))
}

function anchorMinutes(time: string | null | undefined): number {
  if (!time) return 9999
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return 9999
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}
