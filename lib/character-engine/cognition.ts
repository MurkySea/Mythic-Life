import { getCompanionDef } from '@/lib/companions'
import { pickCanonicalCompanionRow } from '@/lib/companion-row-selection'
import {
  hydrateCharacterState,
  type CharacterStateRow,
} from '@/lib/character-engine/persistence'
import {
  applyConversationOutcome,
  createDefaultCharacterState,
} from '@/lib/character-engine/state'
import {
  canOfferOrganicRecognition,
  deriveHabitRecognition,
  selectOrganicRecognitionThought,
  type HabitRecognitionLog,
} from '@/lib/character-engine/organic-recognition'
import type {
  CharacterAnalysis,
  CharacterState,
  DisclosureAssessment,
} from '@/lib/character-engine/types'
import { createClient } from '@/utils/supabase/server'

const CHARACTER_STATE = Symbol.for('mythic-life.character-state')

type KnowledgeLinesWithState = string[] & {
  [CHARACTER_STATE]?: CharacterState
}

type CompanionIdentity = {
  id: string
  slug?: string | null
  name?: string | null
  affinity_score?: number | null
  bond_xp?: number | null
  trust_score?: number | null
  intimacy_score?: number | null
}

type LoadedState = {
  state: CharacterState
  rowId?: string
  companion: CompanionIdentity
}

function chicagoDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function dateKeyDaysAgo(days: number, now = new Date()): string {
  return chicagoDateKey(new Date(now.getTime() - days * 86_400_000))
}

function finiteScore(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null
}

function syncAuthoritativeRelationship(
  state: CharacterState,
  companion: CompanionIdentity
): CharacterState {
  const trust = finiteScore(companion.trust_score)
  const intimacy = finiteScore(companion.intimacy_score)
  if (trust == null && intimacy == null) return state

  return {
    ...state,
    relationship: {
      ...state.relationship,
      // Trust / Intimacy are authoritative in the relationship engine. The
      // Character Engine mirrors them only so dialogue can reason from reality.
      trust: trust ?? state.relationship.trust,
      comfort: intimacy ?? state.relationship.comfort,
    },
  }
}

async function resolveCompanion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companionSlug: string
): Promise<CompanionIdentity | null> {
  const def = getCompanionDef(companionSlug)
  const safeName = def?.name || (companionSlug === 'seraphine' ? 'Seraphine' : companionSlug)
  const { data, error } = await supabase
    .from('companion')
    .select('id, slug, name, affinity_score, bond_xp, trust_score, intimacy_score')
    .or(`slug.eq.${companionSlug},name.eq.${safeName}`)
    .limit(8)

  if (error) throw error
  const canonical = pickCanonicalCompanionRow<CompanionIdentity>((data || []) as CompanionIdentity[], {
    canonicalName: def?.name,
    slug: companionSlug,
  })
  return canonical?.id ? canonical : null
}

async function loadState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  companionSlug: string,
  companion: CompanionIdentity
): Promise<LoadedState> {
  const { data, error } = await supabase
    .from('companion_character_state')
    .select('id, companion_slug, state, updated_at')
    .eq('user_id', userId)
    .eq('companion_id', companion.id)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) throw error
  const row = data?.[0] as (CharacterStateRow & { id?: string }) | undefined
  const hydrated = row
    ? hydrateCharacterState({ companionSlug, row })
    : createDefaultCharacterState(companionSlug)

  return {
    state: syncAuthoritativeRelationship(hydrated, companion),
    rowId: row?.id,
    companion,
  }
}

async function saveState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  loaded: LoadedState
): Promise<void> {
  const payload = {
    user_id: userId,
    companion_id: loaded.companion.id,
    companion_slug: loaded.state.companionSlug,
    state: loaded.state,
    version: loaded.state.version,
    updated_at: loaded.state.updatedAt,
  }

  if (loaded.rowId) {
    const { error } = await supabase
      .from('companion_character_state')
      .update(payload)
      .eq('id', loaded.rowId)
      .eq('user_id', userId)
    if (error) throw error
    return
  }

  const { data, error } = await supabase
    .from('companion_character_state')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw error
  loaded.rowId = data?.id
}

async function refreshOrganicRecognition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  loaded: LoadedState
): Promise<boolean> {
  const today = chicagoDateKey()
  const checkMarker = `recognition-check:${today}`
  if (loaded.state.recentEvents.includes(checkMarker)) return false

  loaded.state = {
    ...loaded.state,
    recentEvents: [...loaded.state.recentEvents, checkMarker].slice(-8),
    updatedAt: new Date().toISOString(),
  }

  const since = dateKeyDaysAgo(27)
  const { data: logs, error: logsError } = await supabase
    .from('habit_logs')
    .select('habit_id, logged_date, completed')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('logged_date', since)
    .order('logged_date', { ascending: false })
    .limit(250)

  if (logsError) throw logsError
  if (!logs?.length) return true

  const typedLogs = logs as Array<{ habit_id: string; logged_date: string; completed: boolean }>
  const habitIds = [...new Set(typedLogs.map((row) => String(row.habit_id)).filter(Boolean))]
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('id, title')
    .eq('user_id', userId)
    .in('id', habitIds)
  if (habitsError) throw habitsError

  const typedHabits = (habits || []) as Array<{ id: string; title: string | null }>
  const titles = new Map(typedHabits.map((habit) => [String(habit.id), String(habit.title || 'Habit')]))
  const recognitionLogs: HabitRecognitionLog[] = typedLogs.map((log) => ({
    habitId: String(log.habit_id),
    title: titles.get(String(log.habit_id)) || 'Habit',
    loggedDate: String(log.logged_date),
    completed: Boolean(log.completed),
  }))

  const candidate = deriveHabitRecognition({ todayKey: today, logs: recognitionLogs })
  if (!candidate) return true

  const alreadyPending = loaded.state.unresolvedThoughts.some((thought) => thought.id === candidate.id)
  const alreadyUsed = loaded.state.recentEvents.includes(`recognition-used:${candidate.id}`)
  if (alreadyPending || alreadyUsed) return true

  loaded.state = {
    ...loaded.state,
    unresolvedThoughts: [
      ...loaded.state.unresolvedThoughts,
      {
        ...candidate,
        createdAt: new Date().toISOString(),
      },
    ].slice(-12),
    updatedAt: new Date().toISOString(),
  }
  return true
}

export function attachCharacterState(
  lines: string[],
  state?: CharacterState
): string[] {
  if (!state) return lines
  Object.defineProperty(lines, CHARACTER_STATE, {
    value: state,
    enumerable: false,
    configurable: false,
  })
  return lines
}

export function getAttachedCharacterState(lines?: string[]): CharacterState | undefined {
  return lines ? (lines as KnowledgeLinesWithState)[CHARACTER_STATE] : undefined
}

/**
 * Load/advance persistent cognition and quietly look for one meaningful real-life
 * pattern. Called through the existing knowledge hook so the main server action
 * does not need another parallel companion pipeline.
 */
export async function loadCharacterCognition(
  companionSlug: string
): Promise<CharacterState | undefined> {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) return undefined

  const companion = await resolveCompanion(supabase, companionSlug)
  if (!companion) return undefined

  const loaded = await loadState(supabase, auth.user.id, companionSlug, companion)
  const changed = await refreshOrganicRecognition(supabase, auth.user.id, loaded)
  if (changed || !loaded.rowId) await saveState(supabase, auth.user.id, loaded)
  return loaded.state
}

function isConflictTurn(userText: string, analysis: CharacterAnalysis): boolean {
  if (analysis.isCorrection) return false
  return /\b(?:angry at you|upset with you|you hurt|betrayed|fight|argument|mad at you)\b/i.test(userText)
}

/**
 * Persist the post-turn cognitive outcome. Trust/Intimacy are mirrored back from
 * the authoritative companion row before storage; this state never becomes a
 * second relationship truth.
 */
export async function persistConversationCognition(opts: {
  companionSlug: string
  userText: string
  analysis: CharacterAnalysis
  disclosure: DisclosureAssessment
}): Promise<void> {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) return

  const companion = await resolveCompanion(supabase, opts.companionSlug)
  if (!companion) return
  const loaded = await loadState(supabase, auth.user.id, opts.companionSlug, companion)

  const notableEvent = opts.analysis.isCorrection
    ? 'Mark corrected her; she should incorporate the correction rather than defend herself.'
    : opts.analysis.isVulnerable
      ? 'Mark trusted her with something vulnerable.'
      : opts.analysis.intent === 'celebration'
        ? 'They shared a moment worth celebrating.'
        : opts.analysis.isExplicitFlirtation
          ? 'The interaction carried explicit flirtation.'
          : undefined

  let next = applyConversationOutcome(loaded.state, {
    positive: opts.analysis.intent === 'celebration' || opts.analysis.intent === 'humor',
    correction: opts.analysis.isCorrection,
    vulnerable: opts.analysis.isVulnerable,
    playful: opts.analysis.intent === 'humor',
    romantic: opts.analysis.isExplicitFlirtation,
    conflict: isConflictTurn(opts.userText, opts.analysis),
    event: notableEvent,
  })

  if (
    canOfferOrganicRecognition({
      analysis: opts.analysis,
      disclosureDepth: opts.disclosure.depth,
    })
  ) {
    const offered = selectOrganicRecognitionThought(next)
    if (offered) {
      const resolvedAt = new Date().toISOString()
      next = {
        ...next,
        unresolvedThoughts: next.unresolvedThoughts.map((thought) =>
          thought.id === offered.id ? { ...thought, resolvedAt } : thought
        ),
        recentEvents: [...next.recentEvents, `recognition-used:${offered.id}`].slice(-8),
        updatedAt: resolvedAt,
      }
    }
  }

  loaded.state = syncAuthoritativeRelationship(next, companion)
  await saveState(supabase, auth.user.id, loaded)
}
