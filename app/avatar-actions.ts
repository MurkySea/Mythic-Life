'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { COMPANION_DEFS } from '@/lib/companions'

/**
 * Set companion.image_url from a gallery image.
 * Maps gallery character_name → companion row (by name or def slug).
 */
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

  // Prefer the exact gallery row when id is provided (guards against stale URLs)
  let finalUrl = imageUrl
  if (galleryId) {
    const { data: row } = await supabase
      .from('gallery_images')
      .select('id, image_url, character_name')
      .eq('id', galleryId)
      .maybeSingle()

    if (!row?.image_url) {
      return { ok: false, error: 'Gallery image not found' }
    }
    if (row.character_name !== characterName) {
      return { ok: false, error: 'Image does not belong to this companion' }
    }
    finalUrl = row.image_url
  }

  const def = COMPANION_DEFS.find(
    (c) => c.name === characterName || c.slug === characterName.toLowerCase()
  )

  // Resolve companion row by name, then by slug from def
  let companionId: string | null = null

  const { data: byName } = await supabase
    .from('companion')
    .select('id, name, slug')
    .eq('name', characterName)
    .maybeSingle()

  if (byName?.id) {
    companionId = byName.id
  } else if (def) {
    const { data: bySlug } = await supabase
      .from('companion')
      .select('id')
      .eq('slug', def.slug)
      .maybeSingle()
    companionId = bySlug?.id ?? null
  }

  if (!companionId) {
    return { ok: false, error: `No companion row for ${characterName}` }
  }

  const { error } = await supabase
    .from('companion')
    .update({ image_url: finalUrl })
    .eq('id', companionId)

  if (error) {
    console.error('setAsAvatar failed', error)
    return { ok: false, error: 'Could not update avatar' }
  }

  revalidatePath('/gallery')
  revalidatePath('/companion-profile')
  revalidatePath('/companions')
  revalidatePath('/messages')
  revalidatePath('/')

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
  const def = COMPANION_DEFS.find(
    (c) => c.name === characterName || c.slug === characterName.toLowerCase()
  )

  const { data: byName } = await supabase
    .from('companion')
    .select('id')
    .eq('name', characterName)
    .maybeSingle()

  let companionId = byName?.id ?? null
  if (!companionId && def) {
    const { data: bySlug } = await supabase
      .from('companion')
      .select('id')
      .eq('slug', def.slug)
      .maybeSingle()
    companionId = bySlug?.id ?? null
  }

  if (!companionId) return { ok: false, error: 'Companion not found' }

  await supabase.from('companion').update({ image_url: null }).eq('id', companionId)

  revalidatePath('/gallery')
  revalidatePath('/companion-profile')
  revalidatePath('/companions')
  revalidatePath('/messages')
  revalidatePath('/')

  return { ok: true }
}
