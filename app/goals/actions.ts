'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  insertGoal,
  bumpGoalProgress,
  abandonGoal,
  pauseGoal,
  resumeGoal,
} from '@/lib/engines/goals-store'
import type { GoalPillar, GoalHorizon } from '@/lib/engines/goals'
import { setFeedback } from '@/lib/feedback'

const PILLARS: GoalPillar[] = [
  'stewardship',
  'faith',
  'marriage',
  'body',
  'homestead',
  'legacy',
  'self',
]

const HORIZONS: GoalHorizon[] = ['daily', 'weekly', 'monthly', 'season', 'ongoing']

function revalidateGoals() {
  revalidatePath('/goals')
  revalidatePath('/')
  revalidatePath('/standing')
}

export async function createGoalAction(formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  const pillar = String(formData.get('pillar') || 'self') as GoalPillar
  const horizon = String(formData.get('horizon') || 'weekly') as GoalHorizon
  const weight = Math.max(1, Math.min(5, parseInt(String(formData.get('weight') || '3'), 10) || 3))
  const target = Math.max(1, parseInt(String(formData.get('target') || '1'), 10) || 1)
  const notes = String(formData.get('notes') || '').trim() || undefined

  if (!title) {
    redirect('/goals/new?err=title')
  }
  if (!PILLARS.includes(pillar)) {
    redirect('/goals/new?err=pillar')
  }
  if (!HORIZONS.includes(horizon)) {
    redirect('/goals/new?err=horizon')
  }

  const goal = await insertGoal({
    title,
    pillar,
    weight,
    horizon,
    target,
    notes,
  })

  if (!goal) {
    redirect('/goals/new?err=save')
  }

  revalidateGoals()
  redirect('/goals?created=1')
}

export async function progressGoalAction(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return

  const result = await bumpGoalProgress(id, 1)

  if (result.justCompleted && result.rewards) {
    await setFeedback({
      skillGains: [],
      bondXp: 0,
      companionName: 'Goals',
      companionSlug: 'seraphine',
      unlocked: [],
      streak: 0,
      // extra fields ignored by banner if unknown — note still useful in console
    }).catch(() => {})
  }

  revalidateGoals()
}

export async function abandonGoalAction(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return
  await abandonGoal(id)
  revalidateGoals()
}

export async function pauseGoalAction(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return
  await pauseGoal(id)
  revalidateGoals()
}

export async function resumeGoalAction(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return
  await resumeGoal(id)
  revalidateGoals()
}
