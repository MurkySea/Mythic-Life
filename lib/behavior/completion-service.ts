import { resolveCompletion } from './pipeline'
import type { RecentWorldEvent, WorldEventKind } from './events'
import type { ActivityKind } from './types'
import { createClient } from '@/utils/supabase/server'

type CompletionRecord = {
  reward: { xp: number; gold: number; completionBonusXp: number }
  momentum: { score: number; band: string; lastActionAt: string | null }
  worldEvent: WorldEventKind | null
}

export async function recordBehavioralCompletion(input: {
  taskId: string
  activityKind: ActivityKind
  effortMinutes: number
  completedAt: Date
}): Promise<CompletionRecord | null> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null

  const [{ data: momentumRow }, { data: eventRows }] = await Promise.all([
    supabase
      .from('momentum_states')
      .select('score, band, last_action_at')
      .eq('scope_type', 'global')
      .eq('scope_key', 'global')
      .maybeSingle(),
    supabase
      .from('world_events')
      .select('kind, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(12),
  ])

  const outcome = resolveCompletion({
    activityKind: input.activityKind,
    effortMinutes: input.effortMinutes,
    previousMomentum: {
      score: Number(momentumRow?.score) || 0,
      band: momentumRow?.band || 'Dormant',
      lastActionAt: momentumRow?.last_action_at || null,
    },
    recentEvents: ((eventRows || []) as Array<{ kind: WorldEventKind; occurred_at: string }>).map((event) => ({
      kind: event.kind,
      occurredAt: event.occurred_at,
    })) satisfies RecentWorldEvent[],
    completedAt: input.completedAt,
  })

  const { data: receipt, error: receiptError } = await supabase
    .from('action_receipts')
    .insert({
      user_id: auth.user.id,
      source_type: 'task',
      source_id: input.taskId,
      action_type: 'complete',
      reward: outcome.reward,
    })
    .select('id')
    .maybeSingle()

  if (receiptError) {
    if (receiptError.code !== '23505') {
      console.error('recordBehavioralCompletion receipt failed', receiptError)
    }
    return null
  }

  await supabase.from('momentum_states').upsert({
    user_id: auth.user.id,
    scope_type: 'global',
    scope_key: 'global',
    score: outcome.momentum.score,
    band: outcome.momentum.band,
    last_action_at: outcome.momentum.lastActionAt,
    updated_at: input.completedAt.toISOString(),
  }, { onConflict: 'user_id,scope_type,scope_key' })

  if (outcome.worldEvent && receipt?.id) {
    await supabase.from('world_events').insert({
      user_id: auth.user.id,
      source_receipt_id: receipt.id,
      kind: outcome.worldEvent,
      payload: { source: 'task_completion' },
      occurred_at: input.completedAt.toISOString(),
    })
  }

  return outcome
}
