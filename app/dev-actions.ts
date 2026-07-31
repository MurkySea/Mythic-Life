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

/**
 * Developer: raise every companion to the affinity-20 scene tier while keeping
 * the primary Trust / Intimacy state synchronized with the legacy mirrors.
 */
export async function devBoostAllAffinity(_formData: FormData): Promise<void> {
  const affinity = 20
  const bondXp = affinity * 35
  const supabase = await createClient()

  const { data: rows, error: loadError } = await supabase
    .from('companion')
    .select('id, slug, name')

  if (loadError) {
    throw new Error(`Unable to load companions for affinity boost: ${loadError.message}`)
  }

  for (const row of rows || []) {
    const slug =
      row.slug ||
      (row.name === 'Seraphine'
        ? 'seraphine'
        : String(row.name || '')
            .toLowerCase()
            .replace(/\s+/g, '_'))

    const scores = backfillScoresFromAffinity({
      slug,
      affinity_score: affinity,
      bond_xp: bondXp,
    })

    const { error: updateError } = await supabase
      .from('companion')
      .update({
        affinity_score: affinity,
        bond_xp: bondXp,
        trust_score: scores.trust,
        intimacy_score: scores.intimacy,
        consecutive_bad_days: 0,
        consecutive_good_days: 0,
      })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(
        `Unable to boost relationship for ${slug || row.id}: ${updateError.message}`
      )
    }
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
    title: 'Seraphine',
    body: 'Just checking you are still with me… did the notification work?',
    url: '/messages',
    tag: 'mythic-test-push',
  })
}

/** Hard reset: wipe progression, keep task list, re-seed Seraphine only. */
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

  const sera = COMPANION_DEFS.find((c) => c.slug === 'seraphine') || COMPANION_DEFS[0]
  const seed = backfillScoresFromAffinity({
    slug: sera.slug,
    affinity_score: 1,
    bond_xp: 0,
  })

  await supabase.from('companion').insert({
    name: sera.name,
    slug: sera.slug,
    title: sera.title,
    personality: sera.personality,
    affinities: sera.affinities,
    is_unlocked: true,
    affinity_score: 1,
    bond_xp: 0,
    trust_score: seed.trust,
    intimacy_score: seed.intimacy,
    consecutive_bad_days: 0,
    consecutive_good_days: 0,
  })

  revalidateApp()
}
