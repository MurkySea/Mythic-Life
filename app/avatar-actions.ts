'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { COMPANION_DEFS } from '@/lib/companions'

function revalidatePortraitSurfaces() {
  revalidatePath('/gallery')
  revalidatePath('/companion-profile')
  revalidatePath('/companions')
  revalidatePath('/messages')
  revalidatePath('/')
}

async function companionIdsForCharacter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  characterName: string
): Promise<string[]> {
  const def = COMPANION_DEFS.find(
    (c) => c.name === characterName || c.slug === characterName.toLowerCase()
  )

  const byName = await supabase
    .from('companion')
    .select('id')
    .eq('name', def?.name || characterName)
    .limit(20)

  if (byName.error) {
    console.error('portrait companion name lookup failed', {
      characterName,
      message: byName.error.message,
    })
  }

  const nameIds = (byName.data || []).map((row) => row.id).filter(Boolean)
  if (nameIds.length > 0) return nameIds

  if (!def) return []

  const bySlug = await supabase
    .from('companion')
    .select('id')
    .eq('slug', def.slug)
    .limit(20)

  if (bySlug.error) {
    console.error('portrait companion slug lookup failed', {
      characterName,
      slug: def.slug,
      message: bySlug.error.message,
    })
  }

  return (bySlug.data || []).map((row) => row.id).filter(Boolean)
}

/** Set companion.image_url from a gallery image. */
export async function setAsAvatar(formData: FormData): Promise<{
  ok: boolean
  error?: string
}> {
  const imageUrl = String(formData.get('image_url') || '').trim()
  const characterName = String(formData.get('character_name') || '').trim()
  const galleryId = String(formData.get('gallery_id') || '').trim()

  if (!imageUrl || !characterName) {
    return { ok: false, error: 'Missing image or character' }
  }

  const supabase = await createClient()

  let finalUrl = imageUrl
  if (galleryId) {
    const { data: row, error: galleryError } = await supabase
      .from('gallery_images')
      .select('id, image_url, character_name')
      .eq('id', galleryId)
      .limit(1)
      .maybeSingle()

    if (galleryError) {
      console.error('portrait gallery lookup failed', {
        galleryId,
        characterName,
        message: galleryError.message,
      })
    }
    if (!row?.image_url) return { ok: false, error: 'Gallery image not found' }
    if (row.character_name !== characterName) {
      return { ok: false, error: 'Image does not belong to this companion' }
    }
    finalUrl = row.image_url
  }

  const companionIds = await companionIdsForCharacter(supabase, characterName)
  if (companionIds.length === 0) {
    console.error('portrait companion row resolution failed', { characterName })
    return { ok: false, error: `No companion row for ${characterName}` }
  }

  const { error } = await supabase
    .from('companion')
    .update({ image_url: finalUrl })
    .in('id', companionIds)

  if (error) {
    console.error('setAsAvatar failed', {
      characterName,
      companionIds,
      message: error.message,
    })
    return { ok: false, error: 'Could not update portrait' }
  }

  console.info('companion portrait updated', {
    characterName,
    rowsSynchronized: companionIds.length,
  })
  revalidatePortraitSurfaces()
  return { ok: true }
}

/** Clear custom avatar — falls back to static embed / emoji. */
export async function clearAvatar(formData: FormData): Promise<{
  ok: boolean
  error?: string
}> {
  const characterName = String(formData.get('character_name') || '').trim()
  if (!characterName) return { ok: false, error: 'Missing character' }

  const supabase = await createClient()
  const companionIds = await companionIdsForCharacter(supabase, characterName)
  if (companionIds.length === 0) {
    console.error('clear portrait companion row resolution failed', { characterName })
    return { ok: false, error: 'Companion not found' }
  }

  const { error } = await supabase
    .from('companion')
    .update({ image_url: null })
    .in('id', companionIds)

  if (error) {
    console.error('clearAvatar failed', {
      characterName,
      companionIds,
      message: error.message,
    })
    return { ok: false, error: 'Could not restore default portrait' }
  }

  console.info('companion portrait cleared', {
    characterName,
    rowsSynchronized: companionIds.length,
  })
  revalidatePortraitSurfaces()
  return { ok: true }
}
