'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCompanionDef } from '@/lib/companions'
import { loadStanding, saveStanding } from '@/lib/engines/standing-store'
import { DATE_GOLD_COST, dateRewards } from '@/lib/engines/loot'
import { deriveDualAxis } from '@/lib/engines/relationship-wire'
import { pickCanonicalCompanionRow } from '@/lib/companion-row-selection'
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

function clampRelationshipScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10
}

/**
 * Spend a date coin (preferred) or gold to take a companion on a date.
 * Dates advance both the primary Trust/Intimacy relationship axes and the
 * legacy Affinity/Bond XP mirrors used by scenes and older UI.
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

  const rowSelect =
    'id, name, slug, affinity_score, bond_xp, trust_score, intimacy_score, image_url'

  const byName = await supabase
    .from('companion')
    .select(rowSelect)
    .eq('name', def?.name || '')
    .limit(20)

  if (byName.error) {
    console.error('date companion name lookup failed', {
      slug,
      defName: def?.name,
      message: byName.error.message,
    })
  }

  let matchingRows = byName.data || []
  if (matchingRows.length === 0) {
    const bySlug = await supabase
      .from('companion')
      .select(rowSelect)
      .eq('slug', slug)
      .limit(20)

    if (bySlug.error) {
      console.error('date companion slug lookup failed', {
        slug,
        defName: def?.name,
        message: bySlug.error.message,
      })
    }
    matchingRows = bySlug.data || []
  }

  const companion = pickCanonicalCompanionRow(matchingRows, {
    canonicalName: def?.name,
    slug,
  })

  if (!companion) {
    console.error('date companion row resolution failed', { slug, defName: def?.name })
    redirect(`/companion-profile?c=${slug}&date=error`)
  }

  const currentDual = deriveDualAxis({
    slug,
    affinity_score: Number(companion.affinity_score) || 1,
    bond_xp: Number(companion.bond_xp) || 0,
    trust_score:
      companion.trust_score != null ? Number(companion.trust_score) : null,
    intimacy_score:
      companion.intimacy_score != null ? Number(companion.intimacy_score) : null,
  })

  const appearance =
    visualCanonPrompt(def) ||
    def?.appearance ||
    'elegant adult woman, distinctive feminine features, graceful figure'
  const characterName = companion.name || def?.name || 'Companion'
  const intimacyProxy = Math.max(0, Math.min(100, currentDual.intimacy.value))

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

  const rewards = dateRewards()
  const nextAffinity = (Number(companion.affinity_score) || 1) + rewards.affinityDelta
  const nextBond = (Number(companion.bond_xp) || 0) + rewards.bondXpDelta
  const nextTrust = clampRelationshipScore(currentDual.trust.value + rewards.trustDelta)
  const nextIntimacy = clampRelationshipScore(
    currentDual.intimacy.value + rewards.intimacyDelta
  )

  const ids = matchingRows.map((row) => row.id).filter(Boolean)
  const { error: relationshipError } = await supabase
    .from('companion')
    .update({
      affinity_score: nextAffinity,
      bond_xp: nextBond,
      trust_score: nextTrust,
      intimacy_score: nextIntimacy,
    })
    .in('id', ids)

  if (relationshipError) {
    console.error('date relationship reward failed', {
      slug,
      characterName,
      ids,
      message: relationshipError.message,
    })
    redirect(`/companion-profile?c=${slug}&date=error`)
  }

  if (useCoin) {
    await saveStanding({ date_coins: standing.date_coins - 1 })
  } else {
    await saveStanding({ total_gold: standing.total_gold - DATE_GOLD_COST })
  }

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

  console.info('date relationship advanced', {
    slug,
    characterName,
    rowsSynchronized: ids.length,
    affinity: [companion.affinity_score, nextAffinity],
    bondXp: [companion.bond_xp, nextBond],
    trust: [currentDual.trust.value, nextTrust],
    intimacy: [currentDual.intimacy.value, nextIntimacy],
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
