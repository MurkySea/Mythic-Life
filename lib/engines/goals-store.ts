/**
 * Goals persistence
 *
 * Run once in Supabase SQL editor:
 *
 * create table if not exists goals (
 *   id uuid primary key default gen_random_uuid(),
 *   title text not null,
 *   pillar text not null,
 *   weight int not null default 3,
 *   horizon text not null default 'weekly',
 *   target int not null default 1,
 *   progress int not null default 0,
 *   status text not null default 'active',
 *   notes text,
 *   skills text,
 *   created_at timestamptz default now(),
 *   completed_at timestamptz,
 *   updated_at timestamptz default now()
 * );
 *
 * create index if not exists goals_status_idx on goals (status);
 * create index if not exists goals_pillar_idx on goals (pillar);
 */

import { createClient } from '@/utils/supabase/server'
import {
  type Goal,
  type GoalPillar,
  type GoalHorizon,
  type GoalStatus,
  createGoal,
  advanceGoal,
  getCompletionRewards,
  getNeglectPenalty,
  PILLAR_LABELS,
} from './goals'
import { saveStanding, loadStanding } from './standing-store'

export interface GoalRow {
  id: string
  title: string
  pillar: string
  weight: number
  horizon: string
  target: number
  progress: number
  status: string
  notes: string | null
  skills: string | null
  created_at: string
  completed_at: string | null
  updated_at?: string
}

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    pillar: row.pillar as GoalPillar,
    weight: row.weight || 3,
    horizon: (row.horizon || 'weekly') as GoalHorizon,
    target: row.target || 1,
    progress: row.progress || 0,
    status: (row.status || 'active') as GoalStatus,
    createdAt: row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    completedAt: row.completed_at?.slice(0, 10) || undefined,
    notes: row.notes || undefined,
    skills: row.skills
      ? row.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
  }
}

export async function listGoals(opts?: {
  status?: GoalStatus | GoalStatus[]
}): Promise<Goal[]> {
  try {
    const supabase = await createClient()
    let q = supabase.from('goals').select('*').order('created_at', { ascending: false })

    if (opts?.status) {
      const statuses = Array.isArray(opts.status) ? opts.status : [opts.status]
      q = q.in('status', statuses)
    }

    const { data, error } = await q
    if (error || !data) {
      console.error('listGoals', error)
      return []
    }
    return (data as GoalRow[]).map(rowToGoal)
  } catch (e) {
    console.error('listGoals failed', e)
    return []
  }
}

export async function getGoal(id: string): Promise<Goal | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('goals').select('*').eq('id', id).maybeSingle()
    if (error || !data) return null
    return rowToGoal(data as GoalRow)
  } catch {
    return null
  }
}

export async function insertGoal(input: {
  title: string
  pillar: GoalPillar
  weight?: number
  horizon?: GoalHorizon
  target: number
  notes?: string
  skills?: string[]
}): Promise<Goal | null> {
  const date = new Date().toISOString().slice(0, 10)
  const draft = createGoal({
    id: 'pending',
    title: input.title.trim(),
    pillar: input.pillar,
    weight: input.weight,
    horizon: input.horizon,
    target: input.target,
    date,
    skills: input.skills,
    notes: input.notes,
  })

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('goals')
      .insert({
        title: draft.title,
        pillar: draft.pillar,
        weight: draft.weight,
        horizon: draft.horizon,
        target: draft.target,
        progress: 0,
        status: 'active',
        notes: draft.notes || null,
        skills: draft.skills?.join(',') || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error || !data) {
      console.error('insertGoal', error)
      return null
    }
    return rowToGoal(data as GoalRow)
  } catch (e) {
    console.error('insertGoal failed', e)
    return null
  }
}

export async function bumpGoalProgress(
  id: string,
  amount = 1
): Promise<{ goal: Goal | null; justCompleted: boolean; rewards?: ReturnType<typeof getCompletionRewards> }> {
  const current = await getGoal(id)
  if (!current || current.status !== 'active') {
    return { goal: current, justCompleted: false }
  }

  const date = new Date().toISOString().slice(0, 10)
  const { goal: next, justCompleted } = advanceGoal(current, amount, date)

  try {
    const supabase = await createClient()
    await supabase
      .from('goals')
      .update({
        progress: next.progress,
        status: next.status,
        completed_at: next.completedAt ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (justCompleted) {
      const rewards = getCompletionRewards(next)
      // Feed tokens / XP / gold into player standing
      const standing = await loadStanding()
      await saveStanding({
        consistency_tokens: Number(
          (standing.consistency_tokens + rewards.tokenGain).toFixed(2)
        ),
        total_xp: standing.total_xp + rewards.xpGain,
        total_gold: standing.total_gold + rewards.goldGain,
      })
      return { goal: next, justCompleted: true, rewards }
    }

    return { goal: next, justCompleted: false }
  } catch (e) {
    console.error('bumpGoalProgress failed', e)
    return { goal: current, justCompleted: false }
  }
}

export async function abandonGoal(id: string): Promise<{
  goal: Goal | null
  penalty?: ReturnType<typeof getNeglectPenalty>
}> {
  const current = await getGoal(id)
  if (!current || current.status !== 'active') {
    return { goal: current }
  }

  const penalty = getNeglectPenalty(current)

  try {
    const supabase = await createClient()
    await supabase
      .from('goals')
      .update({
        status: 'abandoned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    const standing = await loadStanding()
    await saveStanding({
      shadow_debt: Number(
        (standing.shadow_debt + penalty.shadowDebtAdded).toFixed(1)
      ),
    })

    return { goal: penalty.goal, penalty }
  } catch (e) {
    console.error('abandonGoal failed', e)
    return { goal: current }
  }
}

export async function pauseGoal(id: string): Promise<Goal | null> {
  const current = await getGoal(id)
  if (!current || current.status !== 'active') return current

  try {
    const supabase = await createClient()
    await supabase
      .from('goals')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', id)
    return { ...current, status: 'paused' }
  } catch {
    return current
  }
}

export async function resumeGoal(id: string): Promise<Goal | null> {
  const current = await getGoal(id)
  if (!current || current.status !== 'paused') return current

  try {
    const supabase = await createClient()
    await supabase
      .from('goals')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id)
    return { ...current, status: 'active' }
  } catch {
    return current
  }
}

export { PILLAR_LABELS }
