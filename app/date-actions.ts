'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCompanionDef } from '@/lib/companions'
import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import { DATE_GOLD_COST, dateRewards } from '@/lib/engines/loot'
import { pickDateIdea, buildDatePromptFromIdea } from '@/lib/engines/dates'
import { persistGeneratedImage } from '@/lib/persistImage'
import { insertGalleryImage } from '@/lib/galleryKind'
import { recordDateMemory } from '@/lib/memory'

/**
 * Spend a date coin (preferred) or gold to take a companion on a date.
 * Does NOT consume affinity scene slots.
 */
export async function takeCompanionOnDate(formData: FormData) {
  const slug = (formData.get('slug') as string) || 'seraphine'
  const def = getCompanionDef(slug)
  const supabase = await createClient()

  const standing = await loadStanding()
  const useCoin = (standing.date_coins || 0) >= 1
  const canPay = useCoin || standing.total_gold >= DATE_GOLD_COST

  if (!canPay) {
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

  const intimacyProxy = Math.max(0, Math.min(100, companion.affinity_score || 30))

  const idea = pickDateIdea(intimacyProxy)
  const prompt = buildDatePromptFromIdea(idea, {
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
    imageUrl = (data.data?.[0]?.url as string | undefined) ?? null

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

    imageUrl = await persistGeneratedImage(imageUrl, {
      characterName,
      kind: `date_${idea.id}`,
    })
  } catch (e) {
    console.error('date image failed', e)
    redirect(`/companion-profile?c=${slug}&date=error`)
  }

  if (useCoin) {
    await saveStanding({ date_coins: standing.date_coins - 1 })
  } else {
    await saveStanding({ total_gold: standing.total_gold - DATE_GOLD_COST })
  }

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

  await insertGalleryImage(supabase, {
    character_name: characterName,
    image_url: imageUrl,
    affinity_at_generation: nextAffinity,
    prompt_used: `${idea.title} — ${prompt}`,
    kind: 'date',
  })

  try {
    await recordDateMemory(slug, idea.title)
  } catch (e) {
    console.error('date memory failed', e)
  }

  const content = `${idea.line}\\n\\n— ${idea.title} —\\n\\n[image:${imageUrl}]`

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
