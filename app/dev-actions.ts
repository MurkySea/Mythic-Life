'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { COMPANION_DEFS } from '@/lib/companions'

/**
 * Developer: unlock every companion in the roster for testing.
 * Does not max affinity — starts each at affinity 1 / bond 0 unless already higher.
 */
export async function devUnlockAllCompanions() {
  const supabase = await createClient()
  let unlocked = 0

  for (const def of COMPANION_DEFS) {
    const { data: existing } = await supabase
      .from('companion')
      .select('id, affinity_score, bond_xp')
      .or(`slug.eq.${def.slug},name.eq.${def.name}`)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('companion')
        .update({
          is_unlocked: true,
          slug: def.slug,
          title: def.title,
          personality: def.personality,
          affinities: def.affinities,
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
        affinity_score: 1,
        bond_xp: 0,
      })
    }
    unlocked++
  }

  revalidatePath('/companions')
  revalidatePath('/messages')
  revalidatePath('/companion-profile')
  revalidatePath('/settings')
  revalidatePath('/')

  return { ok: true, unlocked }
}

/**
 * Developer: set every unlocked companion to a high affinity for scene testing.
 */
export async function devBoostAllAffinity(level = 20) {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('companion').select('id')
  for (const r of rows || []) {
    await supabase
      .from('companion')
      .update({ affinity_score: level, bond_xp: level * 35 })
      .eq('id', r.id)
  }
  revalidatePath('/companion-profile')
  revalidatePath('/companions')
  revalidatePath('/gallery')
  return { ok: true, level }
}

/**
 * Hard reset: wipe progression and return to a fresh Seraphine-only start.
 * Keeps your task list (real-life productivity data).
 * Clears: companions (re-seeds Seraphine), skills, messages, gallery, memories.
 */
export async function hardResetGame() {
  const supabase = await createClient()

  // Messages
  try {
    const { data: msgs } = await supabase.from('messages').select('id')
    if (msgs && msgs.length > 0) {
      await supabase.from('messages').delete().in(
        'id',
        msgs.map((m) => m.id)
      )
    }
  } catch (e) {
    console.error('reset messages', e)
  }

  // Gallery
  try {
    const { data: imgs } = await supabase.from('gallery_images').select('id')
    if (imgs && imgs.length > 0) {
      await supabase.from('gallery_images').delete().in(
        'id',
        imgs.map((i) => i.id)
      )
    }
  } catch (e) {
    console.error('reset gallery', e)
  }

  // Memories (optional table)
  try {
    const { data: mems } = await supabase.from('companion_memories').select('id')
    if (mems && mems.length > 0) {
      await supabase.from('companion_memories').delete().in(
        'id',
        mems.map((m) => m.id)
      )
    }
  } catch {
    // table may not exist
  }

  // Skills
  try {
    const { data: skills } = await supabase.from('player_skills').select('skill')
    if (skills && skills.length > 0) {
      for (const s of skills) {
        await supabase.from('player_skills').delete().eq('skill', s.skill)
      }
    }
  } catch (e) {
    console.error('reset skills', e)
  }

  // Companions — remove all, re-seed Seraphine
  try {
    const { data: comps } = await supabase.from('companion').select('id')
    if (comps && comps.length > 0) {
      await supabase.from('companion').delete().in(
        'id',
        comps.map((c) => c.id)
      )
    }
  } catch (e) {
    console.error('reset companions', e)
  }

  const sera = COMPANION_DEFS.find((c) => c.slug === 'seraphine') || COMPANION_DEFS[0]
  await supabase.from('companion').insert({
    name: sera.name,
    slug: sera.slug,
    title: sera.title,
    personality: sera.personality,
    affinities: sera.affinities,
    is_unlocked: true,
    affinity_score: 1,
    bond_xp: 0,
    image_url: null,
  })

  revalidatePath('/companions')
  revalidatePath('/messages')
  revalidatePath('/companion-profile')
  revalidatePath('/gallery')
  revalidatePath('/skills')
  revalidatePath('/settings')
  revalidatePath('/')

  return { ok: true }
}
