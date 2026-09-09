'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getHuntBoss, resolveHuntTurn, type HuntAction, type ParryQuality } from '@/lib/hunt'
import { loadDailyHunt, type HuntLogEntry } from '@/lib/hunt-server'

const ACTIONS = new Set<HuntAction>(['strike', 'guard', 'dodge', 'parry'])
const PARRY_QUALITIES = new Set<ParryQuality>(['perfect', 'good', 'miss'])

function clean(value: FormDataEntryValue | null): string {
  return String(value || '').trim().toLowerCase()
}

export async function performHuntAction(formData: FormData): Promise<void> {
  const rawAction = clean(formData.get('action')) as HuntAction
  if (!ACTIONS.has(rawAction)) throw new Error('Choose a valid combat action.')

  const rawQuality = clean(formData.get('parry_quality')) as ParryQuality
  const parryQuality = PARRY_QUALITIES.has(rawQuality) ? rawQuality : undefined

  const snapshot = await loadDailyHunt()
  const { hunt, today, companion } = snapshot
  if (hunt.status === 'victory' || hunt.status === 'defeat') return

  const boss = getHuntBoss(hunt.boss_key) || snapshot.boss
  const result = resolveHuntTurn({
    boss,
    dateKey: today,
    state: {
      bossHp: hunt.boss_hp,
      playerHp: hunt.player_hp,
      resolve: hunt.resolve,
      turn: hunt.turn,
      status: hunt.status,
    },
    action: rawAction,
    parryQuality,
  })

  const now = new Date().toISOString()
  const logEntry: HuntLogEntry = {
    turn: result.turn,
    bossMove: result.bossMove,
    action: rawAction,
    line: result.line,
    bossDamage: result.bossDamage,
    playerDamage: result.playerDamage,
    at: now,
  }
  const battleLog = [...(hunt.battle_log || []), logEntry].slice(-12)
  const victory = result.status === 'victory'
  const claimReward = victory && !hunt.reward_claimed_at

  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('You must be signed in to continue the Hunt.')

  const updatePayload = {
    boss_hp: result.bossHp,
    player_hp: result.playerHp,
    resolve: result.resolve,
    turn: result.turn,
    status: result.status,
    battle_log: battleLog,
    trophy_key: victory ? `${today}:${boss.key}` : hunt.trophy_key,
    trophy_name: victory ? boss.trophy : hunt.trophy_name,
    victory_gold: victory ? boss.rewardGold : hunt.victory_gold,
    reward_claimed_at: claimReward ? now : hunt.reward_claimed_at,
  }

  const { data: updated, error: updateError } = await supabase
    .from('daily_hunts')
    .update(updatePayload)
    .eq('id', hunt.id)
    .eq('user_id', auth.user.id)
    .eq('turn', hunt.turn)
    .select('id')
    .maybeSingle()

  if (updateError) throw new Error(`The Hunt could not advance: ${updateError.message}`)
  if (!updated) {
    // Another tap won the race. Refresh instead of double-applying a combat turn.
    revalidatePath('/hunt')
    revalidatePath('/')
    return
  }

  if (claimReward) {
    const { data: standing } = await supabase
      .from('player_standing')
      .select('total_gold')
      .eq('id', 'solo')
      .maybeSingle()

    const nextGold = Number(standing?.total_gold || 0) + boss.rewardGold
    const { error: goldError } = await supabase
      .from('player_standing')
      .update({ total_gold: nextGold, updated_at: now })
      .eq('id', 'solo')

    if (goldError) console.error('Hunt victory gold could not be awarded', goldError)

    after(async () => {
      try {
        const { generateCompanionResponse } = await import('@/app/actions')
        await generateCompanionResponse(
          `${companion.name} just watched Mark finish today's Hunt against ${boss.name}, ${boss.title}. The victory came after real effort outside the game had already weakened the creature. React as yourself, not as a game announcer or productivity coach. One or two natural sentences are enough.`,
          'hunt-victory',
          {
            force: true,
            isConversation: true,
            companionSlug: companion.slug,
          }
        )
      } catch (error) {
        console.error('Hunt victory companion reaction failed', error)
      }
    })
  }

  revalidatePath('/hunt')
  revalidatePath('/')
  revalidatePath('/rewards')
  revalidatePath('/messages')
}
