'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { COMPANION_DEFS } from '@/lib/companions'

function revalidateApp() {
  revalidatePath('/companions')
  revalidatePath('/messages')
  revalidatePath('/companion-profile')
  revalidatePath('/gallery')
  revalidatePath('/skills')
  revalidatePath('/settings')
  revalidatePath('/')
}

/** Developer: unlock every companion for testing. */
export async function devUnlockAllCompanions(_formData?: FormData) {
  const supabase = await createClient()
  let unlocked = 0

  for (const def of COMPANION_DEFS) {
    const { data: existing } = await supabase
      .from('companion')
      .select('id')
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

  revalidateApp()
  return { ok: true, unlocked }
}

/** Developer: boost all companions to affinity 20 for scene testing. */
export async function devBoostAllAffinity(_formData?: FormData) {
  const level = 20
  const supabase = await createClient()
  const { data: rows } = await supabase.from('companion').select('id')
  for (const r of rows || []) {
    await supabase
      .from('companion')
      .update({ affinity_score: level, bond_xp: level * 35 })
      .eq('id', r.id)
  }
  revalidateApp()
  return { ok: true, level }
}

/**
 * Hard reset: wipe progression, keep task list, re-seed Seraphine only.
 */
export async function hardResetGame(_formData?: FormData) {
  const supabase = await createClient()

  try {
    const { data: msgs } = await supabase.from('messages').select('id')
    if (msgs?.length) {
      await supabase.from('messages').delete().in(
        'id',
        msgs.map((m) => m.id)
      )
    }
  } catch (e) {
    console.error('reset messages', e)
  }

  try {
    const { data: imgs } = await supabase.from('gallery_images').select('id')
    if (imgs?.length) {
      await supabase.from('gallery_images').delete().in(
        'id',
        imgs.map((i) => i.id)
      )
    }
  } catch (e) {
    console.error('reset gallery', e)
  }

  try {
    const { data: mems } = await supabase.from('companion_memories').select('id')
    if (mems?.length) {
      await supabase.from('companion_memories').delete().in(
        'id',
        mems.map((m) => m.id)
      )
    }
  } catch {
    // optional table
  }

  try {
    const { data: skills } = await supabase.from('player_skills').select('skill')
    if (skills?.length) {
      for (const s of skills) {
        await supabase.from('player_skills').delete().eq('skill', s.skill)
      }
    }
  } catch (e) {
    console.error('reset skills', e)
  }

  try {
    const { data: comps } = await supabase.from('companion').select('id')
    if (comps?.length) {
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
  })

  revalidateApp()
  return { ok: true }
}
