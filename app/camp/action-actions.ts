'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { completeTask } from '@/app/complete-task'
import {
  campfireActionAlreadyResolved,
  findStoredCampfireAction,
  saveCampfireActionResolution,
  scheduleTaskForTomorrow,
  type CampfireActionDecision,
} from '@/lib/campfire-actions'

type Choice = 'apply' | 'remember' | 'ignore'

function resolutionDecision(choice: Choice): CampfireActionDecision {
  if (choice === 'remember') return 'remembered'
  if (choice === 'ignore') return 'ignored'
  return 'applied'
}

function revalidateActionSurfaces(): void {
  revalidatePath('/camp')
  revalidatePath('/')
  revalidatePath('/today')
  revalidatePath('/mother-list')
  revalidatePath('/tasks')
  revalidatePath('/messages')
}

export async function resolveCampfireAction(formData: FormData): Promise<void> {
  const batchId = String(formData.get('batch_id') || '').trim()
  const proposalId = String(formData.get('proposal_id') || '').trim()
  const rawChoice = String(formData.get('choice') || '').trim()
  const choice: Choice =
    rawChoice === 'remember' || rawChoice === 'ignore' ? rawChoice : 'apply'

  if (!batchId || !proposalId) return
  if (await campfireActionAlreadyResolved(batchId, proposalId)) return

  const stored = await findStoredCampfireAction(batchId, proposalId)
  if (!stored) return

  const { batch, proposal } = stored
  let createdTaskId: string | null = null

  if (choice === 'apply') {
    if (proposal.kind === 'complete_existing') {
      if (!proposal.targetTaskId) return
      const completion = new FormData()
      completion.set('id', proposal.targetTaskId)
      await completeTask(completion)
    } else if (proposal.kind === 'schedule_existing_tomorrow') {
      if (!proposal.targetTaskId) return
      const supabase = await createClient()
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, is_completed')
        .eq('id', proposal.targetTaskId)
        .maybeSingle()

      if (taskError || !task || task.is_completed) return

      const { error: moveError } = await supabase
        .from('tasks')
        .update({ is_today: false, must_do: false })
        .eq('id', proposal.targetTaskId)
        .eq('is_completed', false)

      if (moveError) {
        console.error('campfire existing task schedule failed', moveError)
        return
      }

      await scheduleTaskForTomorrow(
        proposal.targetTaskId,
        `${batchId}:${proposalId}`,
        batch.companionSlug
      )
    } else if (proposal.kind === 'create_tomorrow') {
      const supabase = await createClient()
      const { data: created, error: createError } = await supabase
        .from('tasks')
        .insert({
          title: proposal.title.trim(),
          notes: 'Planned for tomorrow at the Evening Campfire.',
          domain: null,
          domains: null,
          recurrence: 'none',
          weekdays: null,
          anchor_time: null,
          is_today: false,
          is_completed: false,
        })
        .select('id')
        .single()

      if (createError || !created?.id) {
        console.error('campfire tomorrow task creation failed', createError)
        return
      }

      createdTaskId = created.id
      await scheduleTaskForTomorrow(
        created.id,
        `${batchId}:${proposalId}`,
        batch.companionSlug
      )
    }
  }

  await saveCampfireActionResolution(
    {
      version: 1,
      batchId,
      proposalId,
      decision: resolutionDecision(choice),
      resolvedAt: new Date().toISOString(),
      createdTaskId,
    },
    batch.companionSlug
  )

  revalidateActionSurfaces()
}
