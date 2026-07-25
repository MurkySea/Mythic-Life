'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import {
  rollMusterReward,
  chicagoYmd,
  yesterdayChicagoYmd,
  ANGEL_SLUG,
} from '@/lib/engines/muster'
import { getCompanionDef } from '@/lib/companions'
import { ANGEL_COMPANION } from '@/lib/angelCompanion'
import { dateRewards } from '@/lib/engines/loot'
import { pickDateIdea, buildDatePromptFromIdea } from '@/lib/engines/dates'
import { persistGeneratedImage } from '@/lib/persistImage'
import { setFeedback } from '@/lib/feedback'

async function unlockAngel(): Promise<boolean> {
  const supabase = await createClient()
  const def = ANGEL_COMPANION

  const { data: existing } = await supabase
    .from('companion')
    .select('id, is_unlocked')
    .or(`slug.eq.${def.slug},name.eq.${def.name}`)
    .maybeSingle()

  if (existing?.is_unlocked) return false

  if (existing) {
    await supabase
      .from('companion')
      .update({
        is_unlocked: true,
        slug: def.slug,
        title: def.title,
        personality: def.personality,
        affinities: def.affinities,
        affinity_score: 3,
        bond_xp: 40,
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('companion').insert({
      name: def.name,
      slug: def.slug,
      title: def.title,
      personality: def.personality,
      affinities: def.affinities,
      is_unlocked: true,
      affinity_score: 3,
      bond_xp: 40,
    })
  }

  await supabase.from('messages').insert({
    role: 'companion',
    content: def.unlockLine,
    companion_slug: def.slug,
  })

  return true
}

async function grantSpecialNight(): Promise<{ name: string; slug: string } | null> {
  const supabase = await createClient()
  const { data: party } = await supabase
    .from('companion')
    .select('id, slug, name, affinity_score, bond_xp, image_url')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const list = (party || []).slice()
  if (list.length === 0) return null

  list.sort((a, b) => (b.affinity_score || 0) - (a.affinity_score || 0))
  const top = list[0]
  const slug: string =
    top.slug ||
    (top.name === 'Seraphine'
      ? 'seraphine'
      : String(top.name || 'seraphine')
          .toLowerCase()
          .replace(/\s+/g, '_'))

  const def = getCompanionDef(slug)
  const characterName = top.name || def?.name || 'Companion'
  const appearance =
    def?.appearance ||
    'elegant adult woman, distinctive feminine features, graceful figure'

  const idea = pickDateIdea()
  const prompt = buildDatePromptFromIdea(idea, {
    appearance,
    name: characterName,
    race: def?.race,
  })

  try {
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt,
        n: 1,
      }),
    })
    const data = await response.json()
    let imageUrl = (data.data?.[0]?.url as string | undefined) ?? null
    if (!response.ok || !imageUrl) return { name: characterName, slug }

    imageUrl = await persistGeneratedImage(imageUrl, {
      characterName,
      kind: `muster_${idea.id}`,
    })

    const rewards = dateRewards()
    await supabase
      .from('companion')
      .update({
        affinity_score: (top.affinity_score || 1) + rewards.affinityDelta,
        bond_xp: (top.bond_xp || 0) + rewards.bondXpDelta,
      })
      .eq('id', top.id)

    await supabase.from('gallery_images').insert({
      character_name: characterName,
      image_url: imageUrl,
      affinity_at_generation: (top.affinity_score || 1) + rewards.affinityDelta,
      prompt_used: `[Muster · ${idea.title}] ${prompt}`,
    })

    await supabase.from('messages').insert({
      role: 'companion',
      content: `${idea.line}\n\n— Special night from the muster · ${idea.title} —\n\n[image:${imageUrl}]`,
      companion_slug: slug,
    })

    return { name: characterName, slug }
  } catch (e) {
    console.error('special night failed', e)
    return { name: characterName, slug }
  }
}

/** Server action — form-compatible (returns void). */
export async function claimDailyMuster(_formData?: FormData): Promise<void> {
  const today = chicagoYmd()
  const standing = await loadStanding()

  if (standing.last_muster_date === today) {
    return
  }

  const yesterday = yesterdayChicagoYmd()
  let nextStreak = 1
  if (standing.last_muster_date === yesterday) {
    nextStreak = (standing.muster_streak || 0) + 1
  }

  const reward = rollMusterReward({ streak: nextStreak })

  const patch: Parameters<typeof saveStanding>[0] = {
    last_muster_date: today,
    muster_streak: nextStreak,
  }

  if (reward.kind === 'gold') {
    patch.total_gold = standing.total_gold + reward.amount
  } else if (reward.kind === 'date_coin') {
    patch.date_coins = (standing.date_coins || 0) + reward.amount
  } else if (reward.kind === 'token') {
    patch.consistency_tokens = Number(
      (standing.consistency_tokens + reward.amount).toFixed(2)
    )
  }

  await saveStanding(patch)

  let angelUnlocked = false
  let specialNight: { name: string; slug: string } | null = null

  if (reward.kind === 'angel') {
    angelUnlocked = await unlockAngel()
  } else if (reward.kind === 'special_night') {
    specialNight = await grantSpecialNight()
  }

  if (reward.kind === 'gold' || reward.kind === 'date_coin' || reward.kind === 'token') {
    try {
      const supabase = await createClient()
      const greet =
        nextStreak >= 7
          ? 'Seven days at the muster. The house notices.'
          : nextStreak >= 3
            ? 'Third day running. Keep coming.'
            : 'You made it.'
      await supabase.from('messages').insert({
        role: 'companion',
        content: greet,
        companion_slug: 'seraphine',
      })
    } catch {
      /* non-fatal */
    }
  }

  const lootRarity =
    reward.rarity === 'ultra' || reward.rarity === 'rare'
      ? ('rare' as const)
      : reward.rarity === 'uncommon'
        ? ('uncommon' as const)
        : ('common' as const)

  await setFeedback({
    skillGains: [],
    bondXp: reward.kind === 'special_night' ? 55 : 0,
    companionName:
      reward.kind === 'angel'
        ? ANGEL_COMPANION.name
        : specialNight?.name || 'Muster',
    companionSlug:
      reward.kind === 'angel'
        ? ANGEL_SLUG
        : specialNight?.slug || 'seraphine',
    unlocked: angelUnlocked
      ? [
          {
            name: ANGEL_COMPANION.name,
            slug: ANGEL_SLUG,
            emoji: ANGEL_COMPANION.emoji,
            line: ANGEL_COMPANION.unlockLine,
          },
        ]
      : [],
    streak: nextStreak,
    loot: {
      kind: reward.kind,
      amount: reward.amount,
      label: reward.label,
      rarity: lootRarity,
    },
  })

  revalidatePath('/')
  revalidatePath('/companions')
  revalidatePath('/companion-profile')
  revalidatePath('/messages')
  revalidatePath('/gallery')
  revalidatePath('/standing')
}
