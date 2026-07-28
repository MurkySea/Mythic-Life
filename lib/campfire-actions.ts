import { createClient } from '@/utils/supabase/server'

const ACTION_BATCH_PREFIX = '\u2063\u2063CAMPFIRE_ACTIONS:'
const ACTION_RESOLUTION_PREFIX = '\u2063\u2063CAMPFIRE_ACTION_RESOLUTION:'
const TASK_SCHEDULE_PREFIX = '\u2063\u2063CAMPFIRE_TASK_SCHEDULE:'
const TASK_ACTIVATED_PREFIX = '\u2063\u2063CAMPFIRE_TASK_ACTIVATED:'

export type CampfireActionKind =
  | 'complete_existing'
  | 'schedule_existing_tomorrow'
  | 'create_tomorrow'

export type CampfireActionConfidence = 'medium' | 'high'

export type CampfireActionProposal = {
  id: string
  kind: CampfireActionKind
  title: string
  evidence: string
  confidence: CampfireActionConfidence
  targetTaskId?: string | null
  targetTaskTitle?: string | null
}

export type CampfireActionBatch = {
  version: 1
  date: string
  companionSlug: string
  proposals: CampfireActionProposal[]
  createdAt: string
}

export type StoredCampfireActionBatch = CampfireActionBatch & {
  id: string
}

export type CampfireActionDecision = 'applied' | 'remembered' | 'ignored'

export type CampfireActionResolution = {
  version: 1
  batchId: string
  proposalId: string
  decision: CampfireActionDecision
  resolvedAt: string
  createdTaskId?: string | null
}

export type CampfireActionItem = CampfireActionProposal & {
  batchId: string
  companionSlug: string
  resolution: CampfireActionResolution | null
}

export type OpenTaskForAction = {
  id: string
  title: string
  is_today?: boolean | null
  must_do?: boolean | null
}

type MessageLike = {
  id: string
  content: string | null | undefined
  created_at?: string | null
}

type RawAction = {
  kind?: unknown
  taskTitle?: unknown
  title?: unknown
  evidence?: unknown
  confidence?: unknown
}

type TaskSchedule = {
  version: 1
  taskId: string
  activateOn: string
  proposalId: string
  createdAt: string
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'for', 'from', 'i', 'in', 'it', 'my', 'of', 'on', 'the', 'to',
  'was', 'with', 'that', 'this', 'today', 'tomorrow', 'finally', 'need', 'have', 'got',
])

export function chicagoDateKey(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

export function tomorrowChicagoDateKey(): string {
  const [year, month, day] = chicagoDateKey().split('-').map(Number)
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12))
  noonUtc.setUTCDate(noonUtc.getUTCDate() + 1)
  return noonUtc.toISOString().slice(0, 10)
}

function cleanText(value: unknown, max = 180): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

function taskMatchScore(candidate: string, taskTitle: string): number {
  const a = normalize(candidate)
  const b = normalize(taskTitle)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.94

  const aa = new Set(tokens(a))
  const bb = new Set(tokens(b))
  if (aa.size === 0 || bb.size === 0) return 0

  const shared = [...aa].filter((token) => bb.has(token)).length
  const coverage = shared / Math.min(aa.size, bb.size)
  const union = new Set([...aa, ...bb]).size
  const jaccard = union > 0 ? shared / union : 0
  const singleTokenExact = aa.size === 1 && bb.size === 1 && shared === 1

  if (singleTokenExact) return 0.9
  if (shared < 2) return 0
  return coverage * 0.72 + jaccard * 0.28
}

function findTask(candidate: string, tasks: OpenTaskForAction[]): OpenTaskForAction | null {
  let best: { task: OpenTaskForAction; score: number } | null = null
  for (const task of tasks) {
    const score = taskMatchScore(candidate, task.title)
    if (!best || score > best.score) best = { task, score }
  }
  return best && best.score >= 0.74 ? best.task : null
}

function actionId(kind: CampfireActionKind, title: string, index: number): string {
  const stem = normalize(title).replace(/\s+/g, '-').slice(0, 42) || 'action'
  return `${kind}-${stem}-${index}`
}

function extractJson(raw: string): unknown {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object in Campfire action response')
  return JSON.parse(stripped.slice(start, end + 1))
}

function normalizeActions(
  raw: unknown,
  openTasks: OpenTaskForAction[]
): CampfireActionProposal[] {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rows = Array.isArray(root.actions) ? (root.actions as RawAction[]) : []
  const proposals: CampfireActionProposal[] = []

  for (const row of rows.slice(0, 5)) {
    const rawKind = cleanText(row.kind, 48)
    const evidence = cleanText(row.evidence, 180)
    const confidence: CampfireActionConfidence = row.confidence === 'high' ? 'high' : 'medium'

    if (rawKind === 'complete_existing' || rawKind === 'schedule_existing_tomorrow') {
      const candidate = cleanText(row.taskTitle || row.title, 140)
      const task = findTask(candidate, openTasks)
      if (!task || !evidence) continue
      proposals.push({
        id: actionId(rawKind, task.title, proposals.length),
        kind: rawKind,
        title: task.title,
        evidence,
        confidence,
        targetTaskId: task.id,
        targetTaskTitle: task.title,
      })
      continue
    }

    if (rawKind === 'create_tomorrow') {
      const title = cleanText(row.title || row.taskTitle, 120)
      if (!title || !evidence) continue
      const existing = findTask(title, openTasks)
      if (existing) {
        proposals.push({
          id: actionId('schedule_existing_tomorrow', existing.title, proposals.length),
          kind: 'schedule_existing_tomorrow',
          title: existing.title,
          evidence,
          confidence,
          targetTaskId: existing.id,
          targetTaskTitle: existing.title,
        })
      } else {
        proposals.push({
          id: actionId('create_tomorrow', title, proposals.length),
          kind: 'create_tomorrow',
          title,
          evidence,
          confidence,
          targetTaskId: null,
          targetTaskTitle: null,
        })
      }
    }
  }

  const seen = new Set<string>()
  return proposals
    .filter((proposal) => {
      const key = `${proposal.kind}:${proposal.targetTaskId || normalize(proposal.title)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)
}

function sentenceParts(reflection: string): string[] {
  return reflection
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => cleanText(part, 260))
    .filter(Boolean)
}

function deriveTomorrowTitle(sentence: string): string {
  return cleanText(
    sentence
      .replace(/^.*?\btomorrow\b[,:-]?\s*/i, '')
      .replace(/^(i\s+)?(really\s+)?(need|have|want|plan|intend|hope)\s+to\s+/i, '')
      .replace(/^(i\s+)?(should|must|will|am going to|i'm going to)\s+/i, '')
      .replace(/[.!?]+$/g, ''),
    120
  )
}

function fallbackActions(
  reflection: string,
  openTasks: OpenTaskForAction[]
): CampfireActionProposal[] {
  const proposals: CampfireActionProposal[] = []
  const parts = sentenceParts(reflection)

  for (const sentence of parts) {
    const lower = sentence.toLowerCase()
    const negated = /\b(didn't|did not|couldn't|could not|failed to|forgot to|never got to)\b/.test(lower)
    const future = /\b(tomorrow|next morning)\b/.test(lower)

    if (future && /\b(need|have|want|plan|intend|should|must|will|going)\b/.test(lower)) {
      const title = deriveTomorrowTitle(sentence)
      if (title.length >= 3) {
        const task = findTask(title, openTasks)
        const kind: CampfireActionKind = task ? 'schedule_existing_tomorrow' : 'create_tomorrow'
        proposals.push({
          id: actionId(kind, task?.title || title, proposals.length),
          kind,
          title: task?.title || title,
          evidence: sentence,
          confidence: 'medium',
          targetTaskId: task?.id || null,
          targetTaskTitle: task?.title || null,
        })
      }
    }

    if (!negated && /\b(finished|completed|finally did|got .* done|worked out|went to the gym|already did)\b/.test(lower)) {
      const task = findTask(sentence, openTasks)
      if (task) {
        proposals.push({
          id: actionId('complete_existing', task.title, proposals.length),
          kind: 'complete_existing',
          title: task.title,
          evidence: sentence,
          confidence: 'medium',
          targetTaskId: task.id,
          targetTaskTitle: task.title,
        })
      }
    }
  }

  const seen = new Set<string>()
  return proposals
    .filter((proposal) => {
      const key = `${proposal.kind}:${proposal.targetTaskId || normalize(proposal.title)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)
}

export async function synthesizeCampfireActions(
  reflection: string,
  companionSlug: string,
  openTasks: OpenTaskForAction[]
): Promise<CampfireActionBatch | null> {
  const clean = reflection.trim()
  if (!clean) return null

  let proposals: CampfireActionProposal[] = []

  if (process.env.GROK_API_KEY) {
    const taskList = openTasks
      .slice(0, 140)
      .map((task, index) => `${index + 1}. ${task.title}`)
      .join('\n')

    const prompt = `You are the private action bridge for a companion-led journal.
Read one person's reflection and identify only explicit, useful task changes that require consent.
Return ONLY valid JSON.

Allowed actions:
1. complete_existing — the person clearly says they already completed an OPEN task listed below.
2. schedule_existing_tomorrow — the person clearly says an OPEN task listed below belongs tomorrow.
3. create_tomorrow — the person clearly commits to a concrete task tomorrow and no listed open task matches it.

Rules:
- Never infer an action from emotion, aspiration, vague intention, or ordinary storytelling.
- Do not treat “I should someday,” “I hope,” or “I forgot” as completion.
- Negated completion is never completion.
- Use the exact listed task title for existing-task actions.
- Maximum 3 actions. Empty is correct when uncertain.
- Evidence must be a short exact or closely paraphrased fragment from the reflection.

JSON shape:
{
  "actions": [
    {
      "kind": "complete_existing | schedule_existing_tomorrow | create_tomorrow",
      "taskTitle": "exact open task title for existing actions",
      "title": "concise new task title for create_tomorrow",
      "evidence": "why this was noticed",
      "confidence": "medium | high"
    }
  ]
}

OPEN TASKS:
${taskList || '(none)'}

REFLECTION:
${clean.slice(0, 6000)}`

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-4',
          messages: [
            {
              role: 'system',
              content:
                'Return strict JSON only. Be conservative: no task mutation is allowed without a clear statement and later user approval.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 620,
        }),
      })

      if (!response.ok) throw new Error(`Campfire action request failed: ${response.status}`)
      const data = await response.json()
      const raw = String(data.choices?.[0]?.message?.content || '')
      proposals = normalizeActions(extractJson(raw), openTasks)
    } catch (error) {
      console.error('campfire action synthesis failed', error)
    }
  }

  if (proposals.length === 0) proposals = fallbackActions(clean, openTasks)
  if (proposals.length === 0) return null

  return {
    version: 1,
    date: chicagoDateKey(),
    companionSlug,
    proposals,
    createdAt: new Date().toISOString(),
  }
}

export function encodeCampfireActionBatch(batch: CampfireActionBatch): string {
  return `${ACTION_BATCH_PREFIX}${JSON.stringify(batch)}`
}

export function parseCampfireActionBatch(
  content: string | null | undefined
): CampfireActionBatch | null {
  const text = String(content || '')
  if (!text.startsWith(ACTION_BATCH_PREFIX)) return null
  try {
    const value = JSON.parse(text.slice(ACTION_BATCH_PREFIX.length)) as CampfireActionBatch
    if (value?.version !== 1 || !Array.isArray(value.proposals)) return null
    return value
  } catch {
    return null
  }
}

export function parseCampfireActionResolution(
  content: string | null | undefined
): CampfireActionResolution | null {
  const text = String(content || '')
  if (!text.startsWith(ACTION_RESOLUTION_PREFIX)) return null
  try {
    const value = JSON.parse(text.slice(ACTION_RESOLUTION_PREFIX.length)) as CampfireActionResolution
    if (value?.version !== 1 || !value.batchId || !value.proposalId) return null
    return value
  } catch {
    return null
  }
}

export async function saveCampfireActionBatch(
  batch: CampfireActionBatch
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      role: 'system',
      content: encodeCampfireActionBatch(batch),
      companion_slug: batch.companionSlug,
    })
    .select('id')
    .single()

  if (error) {
    console.error('campfire action batch save failed', error)
    return null
  }
  return data?.id || null
}

export function collectCampfireActionItems(
  messages: MessageLike[],
  date = chicagoDateKey()
): CampfireActionItem[] {
  const resolutions = new Map<string, CampfireActionResolution>()
  for (const message of messages) {
    const resolution = parseCampfireActionResolution(message.content)
    if (resolution) resolutions.set(`${resolution.batchId}:${resolution.proposalId}`, resolution)
  }

  const items: CampfireActionItem[] = []
  for (const message of messages) {
    const batch = parseCampfireActionBatch(message.content)
    if (!batch || batch.date !== date) continue
    for (const proposal of batch.proposals) {
      items.push({
        ...proposal,
        batchId: message.id,
        companionSlug: batch.companionSlug,
        resolution: resolutions.get(`${message.id}:${proposal.id}`) || null,
      })
    }
  }

  return items.slice(-8)
}

export async function saveCampfireActionResolution(
  resolution: CampfireActionResolution,
  companionSlug: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    role: 'system',
    content: `${ACTION_RESOLUTION_PREFIX}${JSON.stringify(resolution)}`,
    companion_slug: companionSlug,
  })
  if (error) console.error('campfire action resolution save failed', error)
}

export async function findStoredCampfireAction(
  batchId: string,
  proposalId: string
): Promise<{ batch: StoredCampfireActionBatch; proposal: CampfireActionProposal } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('id, content, companion_slug')
    .eq('id', batchId)
    .eq('role', 'system')
    .maybeSingle()

  if (error || !data) return null
  const parsed = parseCampfireActionBatch(data.content)
  if (!parsed) return null
  const proposal = parsed.proposals.find((item) => item.id === proposalId)
  if (!proposal) return null
  return { batch: { ...parsed, id: data.id }, proposal }
}

export async function campfireActionAlreadyResolved(
  batchId: string,
  proposalId: string
): Promise<boolean> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('messages')
    .select('content')
    .eq('role', 'system')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(400)

  return (data || []).some((row) => {
    const resolution = parseCampfireActionResolution(row.content)
    return resolution?.batchId === batchId && resolution.proposalId === proposalId
  })
}

export async function scheduleTaskForTomorrow(
  taskId: string,
  proposalId: string,
  companionSlug: string
): Promise<void> {
  const supabase = await createClient()
  const schedule: TaskSchedule = {
    version: 1,
    taskId,
    activateOn: tomorrowChicagoDateKey(),
    proposalId,
    createdAt: new Date().toISOString(),
  }
  const { error } = await supabase.from('messages').insert({
    role: 'system',
    content: `${TASK_SCHEDULE_PREFIX}${JSON.stringify(schedule)}`,
    companion_slug: companionSlug,
  })
  if (error) console.error('campfire task schedule save failed', error)
}

function parseTaskSchedule(content: string | null | undefined): TaskSchedule | null {
  const text = String(content || '')
  if (!text.startsWith(TASK_SCHEDULE_PREFIX)) return null
  try {
    const value = JSON.parse(text.slice(TASK_SCHEDULE_PREFIX.length)) as TaskSchedule
    if (value?.version !== 1 || !value.taskId || !value.activateOn) return null
    return value
  } catch {
    return null
  }
}

export async function activateApprovedCampfireTasks(): Promise<number> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('messages')
    .select('id, content, companion_slug, created_at')
    .eq('role', 'system')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('campfire scheduled task query failed', error)
    return 0
  }

  const rows = data || []
  const activated = new Set(
    rows
      .map((row) => String(row.content || ''))
      .filter((content) => content.startsWith(TASK_ACTIVATED_PREFIX))
      .map((content) => content.slice(TASK_ACTIVATED_PREFIX.length))
  )
  const today = chicagoDateKey()
  let count = 0

  for (const row of rows) {
    const schedule = parseTaskSchedule(row.content)
    if (!schedule || schedule.activateOn > today || activated.has(row.id)) continue

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ is_today: true })
      .eq('id', schedule.taskId)
      .eq('is_completed', false)

    if (updateError) {
      console.error('campfire scheduled task activation failed', updateError)
      continue
    }

    const { error: markerError } = await supabase.from('messages').insert({
      role: 'system',
      content: `${TASK_ACTIVATED_PREFIX}${row.id}`,
      companion_slug: row.companion_slug,
    })
    if (!markerError) count += 1
  }

  return count
}
