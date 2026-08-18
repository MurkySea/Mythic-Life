'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { COMPANION_DEFS } from '@/lib/companions'
import { sendPushToAll } from '@/lib/push'
import { backfillScoresFromAffinity } from '@/lib/engines/relationship-wire'

function revalidateApp() {
  revalidatePath('/companions')
  revalidatePath('/messages')
  revalidatePath('/companion-profile')
  revalidatePath('/gallery')
  revalidatePath('/skills')
  revalidatePath('/settings')
  revalidatePath('/')
}

/** Developer: unlock every companion for testing. Syncs name/title from roster. */
export async function devUnlockAllCompanions(_formData: FormData): Promise<void> {
  const supabase = await createClient()

  for (const def of COMPANION_DEFS) {
    const { data: existing } = await supabase
      .from('companion')
      .select('id')
      .eq('slug', def.slug)
      .maybeSingle()

    let row = existing
    if (!row) {
      const { data: byName } = await supabase
        .from('companion')
        .select('id')
        .eq('name', def.name)
        .maybeSingle()
      row = byName
    }

    if (row) {
      await supabase
        .from('companion')
        .update({
          is_unlocked: true,
          name: def.name,
          slug: def.slug,
          title: def.title,
          personality: def.personality,
          affinities: def.affinities,
        })
        .eq('id', row.id)
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
  }

  revalidateApp()
}

/** Developer: boost all companions to affinity 20 for scene testing. */
export async function devBoostAllAffinity(_formData: FormData): Promise<void> {
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
}

/**
 * One-time (or re-runnable) backfill:
 * derive trust_score + intimacy_score from current affinity_score + bond_xp.
 *
 * Default: only fill rows where trust/intimacy are null or 0.
 * Pass force=1 in formData to overwrite existing dual-axis values.
 */
export async function backfillDualAxisCompanions(
  formData: FormData
): Promise<void> {
  const force = String(formData.get('force') || '') === '1'
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('companion')
    .select('id, slug, name, affinity_score, bond_xp, trust_score, intimacy_score')

  for (const row of rows || []) {
    const hasTrust =
      row.trust_score != null && Number(row.trust_score) > 0
    const hasIntimacy =
      row.intimacy_score != null && Number(row.intimacy_score) > 0

    if (!force && hasTrust && hasIntimacy) continue

    const slug =
      row.slug ||
      (row.name === 'Seraphine'
        ? 'seraphine'
        : String(row.name || '')
            .toLowerCase()
            .replace(/\s+/g, '_'))

    const scores = backfillScoresFromAffinity({
      slug,
      affinity_score: Number(row.affinity_score) || 1,
      bond_xp: Number(row.bond_xp) || 0,
    })

    try {
      await supabase
        .from('companion')
        .update({
          trust_score: scores.trust,
          intimacy_score: scores.intimacy,
        })
        .eq('id', row.id)
    } catch (e) {
      console.error('backfill dual-axis failed for', slug, e)
    }
  }

  revalidateApp()
}

/** Developer: send a test web-push to all stored subscriptions. */
export async function sendTestPush(_formData: FormData): Promise<void> {
  await sendPushToAll({
    title: 'Elowen',
    body: 'Just checking you are still with me… did the notification work?',
    url: '/messages',
    tag: 'mythic-test-push',
  })
}

/** Hard reset: wipe progression, keep task list, re-seed the founding companion. */
export async function hardResetGame(_formData: FormData): Promise<void> {
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

  // `seraphine` is the legacy internal key for the founding slot. The story
  // roster overlay maps that key to Elowen so older chat/memory code stays stable.
  const starter =
    COMPANION_DEFS.find((c) => c.starter) ||
    COMPANION_DEFS.find((c) => c.slug === 'seraphine') ||
    COMPANION_DEFS[0]
  const startingAffinity = 12
  const startingBondXp = 420

  await supabase.from('companion').insert({
    name: starter.name,
    slug: starter.slug,
    title: starter.title,
    personality: starter.personality,
    affinities: starter.affinities,
    is_unlocked: true,
    affinity_score: startingAffinity,
    bond_xp: startingBondXp,
    trust_score: 88,
    intimacy_score: 58,
    consecutive_bad_days: 0,
    consecutive_good_days: 0,
  })

  revalidateApp()
}
