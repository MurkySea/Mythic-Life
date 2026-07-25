'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCompanionDef } from '@/lib/companions'
import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import {
  DATE_GOLD_COST,
  dateRewards,
  buildDateScenePrompt,
} from '@/lib/engines/loot'

/**
 * Spend gold to take a companion on a date.
 * Not transactional love — an experience: dressed-up night-out image,
 * message in thread, big bond/affinity boost.
 */
export async function takeCompanionOnDate(formData: FormData) {
  const slug = (formData.get('slug') as string) || 'seraphine'
  const def = getCompanionDef(slug)
  const supabase = await createClient()

  const standing = await loadStanding()
  if (standing.total_gold < DATE_GOLD_COST) {
    redirect(`/companion-profile?c=${slug}&date=broke`)
  }

  const { data: companion } = await supabase
    .from('companion')
    .select('id, name, slug, affinity_score, bond_xp, image_url')
    .or(`slug.eq.${slug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  if (!companion) {
    redirect(`/companion-profile?c=${slug}&date=error`)
  }

  const appearance =
    def?.appearance ||
    'elegant adult woman, distinctive feminine features, graceful figure'
  const characterName = companion.name || def?.name || 'Companion'

  const prompt = buildDateScenePrompt({
    appearance,
    name: characterName,
    race: def?.race,
  })

  let imageUrl: string | null = null

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
    imageUrl = data.data?.[0]?.url as string | undefined

    if (!response.ok || !imageUrl) {
      const msg = (data?.error?.message || data?.message || '').toString().toLowerCase()
      const blocked =
        msg.includes('safety') ||
        msg.includes('policy') ||
        msg.includes('blocked') ||
        msg.includes('refus') ||
        response.status === 400
      redirect(`/companion-profile?c=${slug}&date=${blocked ? 'blocked' : 'error'}`)
    }
  } catch (e) {
    console.error('date image failed', e)
    redirect(`/companion-profile?c=${slug}&date=error`)
  }

  // Charge gold only after image succeeds
  await saveStanding({
    total_gold: standing.total_gold - DATE_GOLD_COST,
  })

  const rewards = dateRewards()
  const nextAffinity = (companion.affinity_score || 1) + rewards.affinityDelta
  const nextBond = (companion.bond_xp || 0) + rewards.bondXpDelta

  await supabase
    .from('companion')
    .update({
      affinity_score: nextAffinity,
      bond_xp: nextBond,
    })
    .eq('id', companion.id)

  // Gallery entry
  await supabase.from('gallery_images').insert({
    character_name: characterName,
    image_url: imageUrl,
    affinity_at_generation: nextAffinity,
    prompt_used: prompt,
  })

  // Message in thread with image marker
  const lines = [
    `I dressed up for tonight. Thank you for this — not the gold, the choosing me for an evening.`,
    `A whole night just for us. I felt seen the moment we stepped out.`,
    `You spent what you earned so we could have this. That means more than you think.`,
  ]
  const line = lines[Math.floor(Math.random() * lines.length)]
  const content = `${line}\n\n[image:${imageUrl}]`

  await supabase.from('messages').insert({
    role: 'companion',
    content,
    companion_slug: slug,
  })

  revalidatePath('/companion-profile')
  revalidatePath('/companions')
  revalidatePath('/gallery')
  revalidatePath('/messages')
  revalidatePath('/standing')
  revalidatePath('/')

  redirect(`/companion-profile?c=${slug}&date=ok`)
}
