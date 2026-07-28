'use server'

import { createClient } from '@/utils/supabase/server'
import { getCompanionDef } from '@/lib/companions'
import { generateCompanionResponse } from './actions'
import { sendPushToAll } from '@/lib/push'
import {
  buildCampfireFollowUpSeed,
  loadPendingCampfireFollowUp,
  markCampfireFollowUpSent,
} from '@/lib/campfire-director'

async function pushCompanionMessage(opts: {
  slug: string
  name: string
  emoji: string
  message: string | null
}) {
  const preview =
    typeof opts.message === 'string' && opts.message.trim()
      ? opts.message.trim().slice(0, 120)
      : 'She reached out — open Messages.'

  try {
    await sendPushToAll({
      title: `${opts.emoji} ${opts.name}`,
      body: preview,
      url: `/messages?c=${opts.slug}`,
      tag: `companion-${opts.slug}`,
    })
  } catch (error) {
    console.error('push after check-in', error)
  }
}

/**
 * Companion-initiated contact when Mark opens the app.
 * A pending Campfire follow-up gets first priority the next morning.
 * Otherwise the existing occasional in-character check-in remains.
 */
export async function maybeCompanionCheckIn(): Promise<{ sent: boolean; slug?: string }> {
  const pending = await loadPendingCampfireFollowUp()

  if (pending) {
    const slug = pending.companionSlug || 'seraphine'
    const def = getCompanionDef(slug)
    const name = def?.name || 'Companion'
    const emoji = def?.emoji || '✦'

    try {
      const message = await generateCompanionResponse(
        buildCampfireFollowUpSeed(pending),
        'campfire-follow-up',
        {
          force: true,
          isConversation: true,
          companionSlug: slug,
        }
      )

      await markCampfireFollowUpSent(pending.id, slug)
      await pushCompanionMessage({ slug, name, emoji, message })
      return { sent: true, slug }
    } catch (error) {
      console.error('campfire follow-up generate failed', error)
      return { sent: false }
    }
  }

  if (Math.random() > 0.18) return { sent: false }

  const supabase = await createClient()
  const { data: unlocked } = await supabase
    .from('companion')
    .select('slug, name, is_unlocked, affinity_score')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const party = (unlocked || []).filter((companion) => companion.is_unlocked !== false)
  if (party.length === 0) return { sent: false }

  const cutoff = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('messages')
    .select('companion_slug, created_at, role')
    .eq('role', 'companion')
    .gte('created_at', cutoff)
    .limit(40)

  const recentSlugs = new Set((recent || []).map((message) => message.companion_slug || 'seraphine'))

  const candidates = party.filter((companion) => {
    const slug = companion.slug || (companion.name === 'Seraphine' ? 'seraphine' : '')
    return slug && !recentSlugs.has(slug)
  })

  const pool = candidates.length > 0 ? candidates : party
  const pick = pool[Math.floor(Math.random() * pool.length)]
  const slug = pick.slug || 'seraphine'
  const def = getCompanionDef(slug)
  const name = def?.name || pick.name || 'Companion'
  const emoji = def?.emoji || '✦'

  const seeds = [
    `${name} reaches out first — a quiet check-in, not a report. She noticed the day passing and wanted a thread of contact with Mark without demanding a reply.`,
    `${name} initiates contact the way she would in her own world: brief, in-character, emotionally real. She is not reviewing productivity.`,
    `Unprompted message from ${name}. Something small she wanted Mark to hear — presence, not a task.`,
  ]
  const seed = seeds[Math.floor(Math.random() * seeds.length)]

  try {
    const message = await generateCompanionResponse(seed, 'check-in', {
      force: true,
      isConversation: true,
      companionSlug: slug,
    })

    await pushCompanionMessage({ slug, name, emoji, message })
    return { sent: true, slug }
  } catch (error) {
    console.error('check-in generate failed', error)
    return { sent: false }
  }
}
