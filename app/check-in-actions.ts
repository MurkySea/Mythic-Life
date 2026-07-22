'use server'

import { createClient } from '@/utils/supabase/server'
import { getCompanionDef } from '@/lib/companions'
import { generateCompanionResponse } from './actions'
import { sendPushToAll } from '@/lib/push'

/**
 * Occasional companion-initiated message when Mark opens the app.
 * ~18% chance; skips companions who already spoke in ~16h.
 * Writes to Messages and attempts Web Push if subscriptions exist.
 */
export async function maybeCompanionCheckIn(): Promise<{ sent: boolean; slug?: string }> {
  if (Math.random() > 0.18) return { sent: false }

  const supabase = await createClient()
  const { data: unlocked } = await supabase
    .from('companion')
    .select('slug, name, is_unlocked, affinity_score')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const party = (unlocked || []).filter((c) => c.is_unlocked !== false)
  if (party.length === 0) return { sent: false }

  const cutoff = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('messages')
    .select('companion_slug, created_at, role')
    .eq('role', 'companion')
    .gte('created_at', cutoff)
    .limit(40)

  const recentSlugs = new Set((recent || []).map((m) => m.companion_slug || 'seraphine'))

  const candidates = party.filter((c) => {
    const s = c.slug || (c.name === 'Seraphine' ? 'seraphine' : '')
    return s && !recentSlugs.has(s)
  })

  const pool = candidates.length > 0 ? candidates : party
  const pick = pool[Math.floor(Math.random() * pool.length)]
  const slug = pick.slug || (pick.name === 'Seraphine' ? 'seraphine' : 'seraphine')
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

    const preview =
      typeof message === 'string' && message.trim()
        ? message.trim().slice(0, 120)
        : 'She reached out — open Messages.'

    try {
      await sendPushToAll({
        title: `${emoji} ${name}`,
        body: preview,
        url: `/messages?c=${slug}`,
        tag: `companion-${slug}`,
      })
    } catch (e) {
      console.error('push after check-in', e)
    }

    return { sent: true, slug }
  } catch (e) {
    console.error('check-in generate failed', e)
    return { sent: false }
  }
}
