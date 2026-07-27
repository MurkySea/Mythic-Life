'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getCompanionDef } from '@/lib/companions'
import {
  applyOutreachResponse,
  intensityFromMessage,
  companionScorePatch,
  type LiveCompanionScores,
} from '@/lib/engines/relationship-wire'
import type { ResponseChoice } from '@/lib/engines/relationship'
import { markConversationRead, pushIfStillUnread } from '@/lib/reads'

/** Natural first-person lines for each response choice */
const RESPONSE_LINES: Record<ResponseChoice, string[]> = {
  honest: [
    "It's been off. I'm not fine — I'm trying to be honest about that.",
    "You're right to notice. Things have been slipping more than I wanted to admit.",
    "I've been struggling more than I let on. Thanks for asking.",
  ],
  ask_support: [
    "I could use you in this, if you're willing. I don't want to carry it alone.",
    "Stay close for a bit? I need the company more than a fix.",
    "Help me not disappear into it. Just… be here.",
  ],
  push_through: [
    "I just need to lock in and get through this stretch. I'll be alright.",
    "I'm pushing through it. Not ignoring you — just focused on getting back on track.",
    "Give me a little room to grind this out. I'll come back clearer.",
  ],
  deflect: [
    "I'm fine. Just a busy stretch.",
    "Don't worry about it — nothing serious.",
    "It's nothing. Really.",
  ],
}

function pickLine(choice: ResponseChoice): string {
  const pool = RESPONSE_LINES[choice]
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Player answers a companion's outreach / check-in with one of four choices.
 * Applies dual-axis effects to affinity/bond, posts a natural message, generates reply.
 * Returns note + stage for the UI feedback banner.
 */
export async function respondWithChoice(formData: FormData): Promise<{
  note: string
  stage: string
} | void> {
  const choice = formData.get('choice') as ResponseChoice
  const companionSlug = (formData.get('companion_slug') as string) || 'seraphine'

  if (!['honest', 'deflect', 'push_through', 'ask_support'].includes(choice)) {
    return
  }

  const supabase = await createClient()
  const def = getCompanionDef(companionSlug)

  const { data: companion } = await supabase
    .from('companion')
    .select(
      'id, slug, name, affinity_score, bond_xp, consecutive_bad_days, consecutive_good_days, trust_score, intimacy_score'
    )
    .or(`slug.eq.${companionSlug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  if (!companion) return

  // Last companion message → intensity heuristic
  const { data: recent } = await supabase
    .from('messages')
    .select('role, content, companion_slug')
    .order('created_at', { ascending: false })
    .limit(12)

  const lastCompanion = (recent || []).find((m) => {
    if (m.role !== 'companion') return false
    if (companionSlug === 'seraphine') {
      return !m.companion_slug || m.companion_slug === 'seraphine'
    }
    return m.companion_slug === companionSlug
  })

  const intensity = intensityFromMessage(lastCompanion?.content || '')

  const scores: LiveCompanionScores = {
    slug: companionSlug,
    affinity_score: Number(companion.affinity_score) || 1,
    bond_xp: Number(companion.bond_xp) || 0,
    consecutive_bad_days:
      companion.consecutive_bad_days != null
        ? Number(companion.consecutive_bad_days)
        : null,
    consecutive_good_days:
      companion.consecutive_good_days != null
        ? Number(companion.consecutive_good_days)
        : null,
    trust_score:
      companion.trust_score != null ? Number(companion.trust_score) : null,
    intimacy_score:
      companion.intimacy_score != null ? Number(companion.intimacy_score) : null,
  }

  const applied = applyOutreachResponse(scores, choice, intensity)

  const nextAffinity = Math.max(
    1,
    Math.round(((Number(companion.affinity_score) || 1) + applied.affinityDelta) * 10) /
      10
  )
  const nextBond = Math.max(
    0,
    (Number(companion.bond_xp) || 0) + applied.bondXpDelta
  )

  // Prefer writing dual-axis when columns exist; always write affinity + bond
  const patch = companionScorePatch({
    affinity: nextAffinity,
    bondXp: nextBond,
  })

  // Soft dual-axis write: if columns exist this lands; if not, ignore error path
  try {
    await supabase.from('companion').update(patch).eq('id', companion.id)
  } catch (e) {
    console.error('companion score update failed', e)
  }

  // Natural user message
  const text = pickLine(choice)
  await supabase.from('messages').insert({
    role: 'user',
    content: text,
    companion_slug: companionSlug,
  })

  await markConversationRead(companionSlug)

  revalidatePath('/messages')
  revalidatePath('/companions')
  revalidatePath('/companion-profile')
  revalidatePath('/')

  // Background companion reply — seed includes the mechanical note so her tone lands
  after(async () => {
    try {
      const { generateCompanionResponse } = await import('./actions')
      const seed = `${text}\n\n(Private context for you only — do not quote: he answered your check-in with "${choice}". ${applied.note} Respond as yourself, human and present, not as a system.)`

      const reply = await generateCompanionResponse(seed, 'conversation', {
        force: true,
        isConversation: true,
        companionSlug,
      })

      revalidatePath('/messages')

      if (reply && typeof reply === 'string') {
        const name = def?.name || companion.name || 'Companion'
        const emoji = def?.emoji || '✦'
        await pushIfStillUnread({
          companionSlug,
          messageCreatedAt: new Date().toISOString(),
          title: `${emoji} ${name}`,
          body: reply.trim().slice(0, 120),
          tag: `chat-${companionSlug}`,
        })
      }
    } catch (e) {
      console.error('response choice reply failed', e)
    }
  })

  return {
    note: applied.note,
    stage: applied.stage,
  }
}
