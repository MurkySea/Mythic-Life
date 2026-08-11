'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import {
  updateTaskStreak,
  awardSkillXp,
  pickReactingCompanion,
  awardBondProgress,
  postUnlockCeremony,
  generateCompanionResponse,
} from './actions'
import { maybeScheduleTaskReaction } from '@/lib/outreach'
import { parseDomains, SKILL_LABELS, type SkillKey } from '@/lib/skills'
import { getCompanionDef } from '@/lib/companions'
import { setFeedback } from '@/lib/feedback'
import { runStandingForCompletedTask } from '@/lib/engines/apply-task'
import { rollQuestLoot } from '@/lib/engines/loot'
import { applyLootDrop } from '@/lib/engines/apply-loot'
import { recordBehavioralCompletion } from '@/lib/behavior/completion-service'
import type { ActivityKind } from '@/lib/behavior/types'

/**
 * Secure, idempotent task completion.
 *
 * Security (2026-07-25):
 * - Only the task `id` is accepted from the client.
 * - Title and domains are always loaded from the database.
 * - Client-supplied title/domains are ignored so they cannot inflate XP or bonds.
 *
 * Idempotency:
 * - If the task is already completed, the action is a no-op.
 * - The mark-complete update is conditional on `is_completed = false`.
 * - Awards only run if that conditional update actually changed a row.
 *   This prevents double-awards on double-submit or network retries.
 */
export async function completeTask(formData: FormData): Promise<void> {
  const id = (formData.get('id') as string | null)?.trim()
  if (!id) return

  const supabase = await createClient()

  // 1. Load the real task — never trust client title/domains
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select(
      'id, title, domains, domain, is_completed, recurrence, streak_count, last_streak_date, activity_kind, effort_minutes'
    )
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !task) {
    console.error('completeTask: task not found', id, fetchError)
    return
  }

  // 2. Already done → pure no-op (idempotent)
  if (task.is_completed) return

  // 3. Conditional mark-complete (race-safe)
  const { data: updated, error: updateError } = await supabase
    .from('tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('is_completed', false)
    .select('id')
    .maybeSingle()

  if (updateError || !updated) {
    // Lost the race or row disappeared — do not award
    return
  }

  // 4. All rewards derived from server-side task data only
  const title = task.title || 'Quest'
  const domains = parseDomains(task.domains, task.domain)

  const completedAt = new Date()
  const behavioralCompletion = await recordBehavioralCompletion({
    taskId: id,
    activityKind: (task.activity_kind || (task.recurrence === 'daily' || task.recurrence === 'weekly' ? 'ritual' : 'quest')) as ActivityKind,
    effortMinutes: Number(task.effort_minutes) || 30,
    completedAt,
  })

  const { streak } = await updateTaskStreak(id)
  const { newlyUnlocked, skillGains } = await awardSkillXp(domains)
  const slug = await pickReactingCompanion(domains)
  const bond = await awardBondProgress(domains.join(','), streak, slug)
  const unlockedDetails = await postUnlockCeremony(newlyUnlocked)

  await runStandingForCompletedTask({ title, domains })

  const loot = rollQuestLoot({ streak })
  try {
    await applyLootDrop(loot, slug)
  } catch (e) {
    console.error('loot apply failed', e)
  }

  const def = getCompanionDef(slug)
  await setFeedback({
    skillGains: (skillGains || []).map((g) => ({
      skill: g.skill,
      label: SKILL_LABELS[g.skill as SkillKey] || g.skill,
      xp: g.xpAdded,
      level: g.level,
    })),
    bondXp: bond.xpGained || 0,
    companionName: def?.name || 'Companion',
    companionSlug: slug,
    unlocked: unlockedDetails,
    streak,
    loot: loot.kind === 'nothing' ? null : loot,
  })

  if (behavioralCompletion?.worldEvent) {
    console.info('world event discovered', behavioralCompletion.worldEvent)
  }

  revalidatePath('/')
  revalidatePath('/standing')
  revalidatePath('/skills')
  revalidatePath('/companions')
  revalidatePath('/companion-profile')

  after(async () => {
    try {
      await generateCompanionResponse(title, domains.join(', '), {
        streak,
        companionSlug: slug,
      })
      await maybeScheduleTaskReaction({
        taskTitle: title,
        companionSlug: slug,
        domains: domains.join(','),
      })
      revalidatePath('/messages')
      revalidatePath('/')
    } catch (e) {
      console.error('background companion reply failed', e)
    }
  })
}
