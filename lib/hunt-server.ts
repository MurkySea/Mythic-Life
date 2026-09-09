import 'server-only'

import { createClient } from '@/utils/supabase/server'
import { chicagoDateKey } from '@/lib/daily-ritual'
import { getCompanionDef } from '@/lib/companions'
import {
  HUNT_FRESH_FLOOR_HP,
  HUNT_RESOLVE_CAP,
  bossForDate,
  computeHuntPrep,
  telegraphForMove,
  bossMoveForTurn,
  type BossMove,
  type HuntAction,
  type HuntBoss,
  type HuntPrep,
  type HuntStatus,
} from '@/lib/hunt'

export type HuntLogEntry = {
  turn: number
  bossMove: BossMove
  action: HuntAction
  line: string
  bossDamage: number
  playerDamage: number
  at: string
}

export type DailyHuntRow = {
  id: string
  user_id: string
  hunt_date: string
  boss_key: string
  boss_name: string
  boss_title: string
  boss_max_hp: number
  boss_hp: number
  player_hp: number
  resolve: number
  prep_damage_applied: number
  prep_resolve_earned: number
  turn: number
  status: HuntStatus
  companion_slug: string
  battle_log: HuntLogEntry[] | null
  trophy_key: string | null
  trophy_name: string | null
  victory_gold: number
  reward_claimed_at: string | null
  created_at: string
  updated_at: string
}

export type HuntCompanion = {
  slug: string
  name: string
  emoji: string
  trust: number
  intimacy: number
  boonResolve: number
  boonLabel: string | null
}

export type HuntSnapshot = {
  today: string
  boss: HuntBoss
  hunt: DailyHuntRow
  prep: HuntPrep
  completedTaskCount: number
  completedHabitCount: number
  morningDone: boolean
  mainQuestDone: boolean
  companion: HuntCompanion
  bossMove: BossMove | null
  telegraph: string | null
}

function finiteScore(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0
}

function parseLog(value: unknown): HuntLogEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is HuntLogEntry => Boolean(entry) && typeof entry === 'object')
    .slice(-12)
}

async function companionForHunt(
  slug: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<HuntCompanion> {
  const def = getCompanionDef(slug) || getCompanionDef('seraphine')
  const canonicalSlug = def?.slug || 'seraphine'
  const { data } = await supabase
    .from('companion')
    .select('slug, name, trust_score, intimacy_score')
    .eq('slug', canonicalSlug)
    .maybeSingle()

  const trust = finiteScore(data?.trust_score)
  const intimacy = finiteScore(data?.intimacy_score)
  const boonResolve = trust >= 60 ? 1 : 0

  return {
    slug: canonicalSlug,
    name: def?.name || data?.name || 'Companion',
    emoji: def?.emoji || '✦',
    trust,
    intimacy,
    boonResolve,
    boonLabel: boonResolve > 0 ? `${def?.name || 'Companion'} · Old Instinct (+1 Resolve)` : null,
  }
}

export async function loadDailyHunt(): Promise<HuntSnapshot> {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('You must be signed in to enter the Hunt.')

  const userId = auth.user.id
  const today = chicagoDateKey()
  const boss = bossForDate(today)

  const [huntResult, ritualResult, tasksResult, habitsResult] = await Promise.all([
    supabase
      .from('daily_hunts')
      .select('*')
      .eq('user_id', userId)
      .eq('hunt_date', today)
      .maybeSingle(),
    supabase
      .from('daily_rituals')
      .select('morning_completed_at, morning_companion_slug, main_quest_task_id')
      .eq('user_id', userId)
      .eq('ritual_date', today)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('id, difficulty, must_do, completed_at')
      .eq('is_completed', true)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(160),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('logged_date', today)
      .eq('completed', true),
  ])

  if (huntResult.error) throw new Error(`The Hunt could not be loaded: ${huntResult.error.message}`)

  const completedTasks = (tasksResult.data || []).filter((task) =>
    task.completed_at ? chicagoDateKey(task.completed_at) === today : false
  )
  const completedHabitCount = habitsResult.data?.length || 0
  const ritual = ritualResult.data
  const morningDone = Boolean(ritual?.morning_completed_at)
  const mainQuestDone = Boolean(
    ritual?.main_quest_task_id && completedTasks.some((task) => task.id === ritual.main_quest_task_id)
  )

  const companionSlug =
    ritual?.morning_companion_slug || huntResult.data?.companion_slug || 'seraphine'
  const companion = await companionForHunt(companionSlug, supabase)
  const prep = computeHuntPrep({
    tasks: completedTasks.map((task) => ({
      difficulty: task.difficulty,
      mustDo: task.must_do,
    })),
    completedHabits: completedHabitCount,
    morningDone,
    mainQuestDone,
  })
  const targetResolveEarned = Math.min(HUNT_RESOLVE_CAP, prep.resolveEarned + companion.boonResolve)

  let hunt = huntResult.data as DailyHuntRow | null
  if (!hunt) {
    const { data: inserted, error: insertError } = await supabase
      .from('daily_hunts')
      .insert({
        user_id: userId,
        hunt_date: today,
        boss_key: boss.key,
        boss_name: boss.name,
        boss_title: boss.title,
        boss_max_hp: boss.maxHp,
        boss_hp: boss.maxHp,
        player_hp: 5,
        resolve: 0,
        prep_damage_applied: 0,
        prep_resolve_earned: 0,
        turn: 0,
        status: 'ready',
        companion_slug: companion.slug,
        battle_log: [],
      })
      .select('*')
      .single()

    if (insertError || !inserted) {
      throw new Error(`Today's Hunt could not be manifested: ${insertError?.message || 'unknown error'}`)
    }
    hunt = inserted as DailyHuntRow
  }

  if (hunt.status === 'ready' || hunt.status === 'active') {
    const prepDamageTarget = Math.max(hunt.prep_damage_applied, prep.damage)
    const damageDelta = Math.max(0, prepDamageTarget - hunt.prep_damage_applied)
    const resolveTarget = Math.max(hunt.prep_resolve_earned, targetResolveEarned)
    const resolveDelta = Math.max(0, resolveTarget - hunt.prep_resolve_earned)
    const bossFloor = hunt.turn === 0 ? HUNT_FRESH_FLOOR_HP : 1
    const bossHp = Math.max(bossFloor, hunt.boss_hp - damageDelta)
    const resolve = Math.min(HUNT_RESOLVE_CAP, hunt.resolve + resolveDelta)

    if (
      bossHp !== hunt.boss_hp ||
      resolve !== hunt.resolve ||
      prepDamageTarget !== hunt.prep_damage_applied ||
      resolveTarget !== hunt.prep_resolve_earned ||
      hunt.companion_slug !== companion.slug
    ) {
      const { data: updated, error: updateError } = await supabase
        .from('daily_hunts')
        .update({
          boss_hp: bossHp,
          resolve,
          prep_damage_applied: prepDamageTarget,
          prep_resolve_earned: resolveTarget,
          companion_slug: companion.slug,
        })
        .eq('id', hunt.id)
        .eq('user_id', userId)
        .select('*')
        .single()

      if (updateError || !updated) throw new Error(`The Hunt could not absorb today's progress: ${updateError?.message || 'unknown error'}`)
      hunt = updated as DailyHuntRow
    }
  }

  hunt = { ...hunt, battle_log: parseLog(hunt.battle_log) }
  const bossMove = hunt.status === 'ready' || hunt.status === 'active'
    ? bossMoveForTurn(boss, today, hunt.turn)
    : null

  return {
    today,
    boss,
    hunt,
    prep,
    completedTaskCount: completedTasks.length,
    completedHabitCount,
    morningDone,
    mainQuestDone,
    companion,
    bossMove,
    telegraph: bossMove ? telegraphForMove(bossMove) : null,
  }
}

export async function loadRecentHuntVictories(limit = 6): Promise<DailyHuntRow[]> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []

  const { data } = await supabase
    .from('daily_hunts')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('status', 'victory')
    .order('hunt_date', { ascending: false })
    .limit(Math.max(1, Math.min(12, limit)))

  return ((data || []) as DailyHuntRow[]).map((row) => ({
    ...row,
    battle_log: parseLog(row.battle_log),
  }))
}
