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
import {
  loadVisualMemoryHints,
  dateLineForMemory,
} from '@/lib/memory-visual'
import { visualCanonPrompt } from '@/lib/characterSheets'
import { generateXaiImage } from '@/lib/xai-image'

/**
 * Spend a date coin (preferred) or gold to take a companion on a date.
 * Memory biases the pick, flavors the image, and — when it matches —
 * rewrites her spoken line so she names why she chose the night.
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

  const rowSelect = 'id, name, slug, affinity_score, bond_xp, image_url'
  const byName = await supabase
    .from('companion')
    .select(rowSelect)
    .eq('name', def?.name || '')
    .limit(1)
    .maybeSingle()

  if (byName.error) {
    console.error('date companion name lookup failed', {
      slug,
      defName: def?.name,
      message: byName.error.message,
    })
  }

  let companion = byName.data
  if (!companion) {
    const bySlug = await supabase
      .from('companion')
      .select(rowSelect)
      .eq('slug', slug)
      .limit(1)
      .maybeSingle()

    if (bySlug.error) {
      console.error('date companion slug lookup failed', {
        slug,
        defName: def?.name,
        message: bySlug.error.message,
      })
    }
    companion = bySlug.data
  }

  if (!companion) {
    console.error('date companion row resolution failed', { slug, defName: def?.name })
    redirect(`/companion-profile?c=${slug}&date=error`)
  }

  const appearance =
    visualCanonPrompt(def) ||
    def?.appearance ||
    'elegant adult woman, distinctive feminine features, graceful figure'
  const characterName = companion.name || def?.name || 'Companion'

  const intimacyProxy = Math.max(0, Math.min(100, companion.affinity_score || 30))

  const visual = await loadVisualMemoryHints(slug)
  const idea = pickDateIdea(intimacyProxy, visual.tags)
  const prompt = buildDatePromptFromIdea(idea, {
    appearance,
    name: characterName,
    race: def?.race,
    memoryHints: visual.lines,
  })

  const spoken = dateLineForMemory(idea.id, idea.line, visual.tags)

  const generated = await generateXaiImage(prompt)
  if (!generated.ok) {
    const status = generated.kind === 'blocked' ? 'blocked' : 'error'
    console.error('date image generation failed', {
      slug,
      characterName,
      status,
      providerKind: generated.kind,
      providerStatus: generated.status,
      providerModel: generated.model,
      providerMessage: generated.message.slice(0, 300),
    })
    redirect(`/companion-profile?c=${slug}&date=${status}`)
  }

  const imageUrl = await persistGeneratedImage(generated.url, {
    characterName,
    kind: `date_${idea.id}`,
  })

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

  const content = [
    spoken.line,
    '',
    `— ${idea.title} —`,
    '',
    `[image:${imageUrl}]`,
  ].join('\n')

  await supabase.from('messages').insert({
    role: 'companion',
    content,
    companion_slug: slug,
  })

  console.info('date image preserved', {
    slug,
    characterName,
    model: generated.model,
    idea: idea.id,
  })

  revalidatePath('/companion-profile')
  revalidatePath('/companions')
  revalidatePath('/gallery')
  revalidatePath('/messages')
  revalidatePath('/standing')
  revalidatePath('/')

  redirect(`/companion-profile?c=${slug}&date=ok`)
}
