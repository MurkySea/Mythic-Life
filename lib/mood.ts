import type { Mood } from '@/lib/companionVoice'
import { createClient } from '@/utils/supabase/server'

const VALID: Mood[] = [
  'soft',
  'warm',
  'tired',
  'sharp',
  'distant',
  'playful',
  'guarded',
  'hungry_for_him',
]

const TTL_MS = 3 * 60 * 60 * 1000 // 3 hours

function isMood(v: string | null | undefined): v is Mood {
  return !!v && (VALID as string[]).includes(v)
}

/** Load persisted mood if still fresh. */
export async function loadPersistedMood(
  companionId: string | undefined
): Promise<{ mood: Mood; ageMs: number } | null> {
  if (!companionId) return null
  const supabase = await createClient()
  try {
    const { data } = await supabase
      .from('companion')
      .select('mood_state, mood_updated_at')
      .eq('id', companionId)
      .maybeSingle()

    if (!data?.mood_state || !data.mood_updated_at) return null
    if (!isMood(data.mood_state)) return null

    const ageMs = Date.now() - new Date(data.mood_updated_at).getTime()
    if (ageMs < 0 || ageMs > TTL_MS) return null
    return { mood: data.mood_state, ageMs }
  } catch {
    return null
  }
}

export async function savePersistedMood(
  companionId: string | undefined,
  mood: Mood
): Promise<void> {
  if (!companionId) return
  const supabase = await createClient()
  try {
    await supabase
      .from('companion')
      .update({
        mood_state: mood,
        mood_updated_at: new Date().toISOString(),
      })
      .eq('id', companionId)
  } catch (e) {
    // columns may not exist yet — non-fatal
    console.error('save mood', e)
  }
}

/** Soft continuity: keep prior mood often; allow gentle drift. */
export function continueMood(
  previous: Mood | null | undefined,
  nextCandidate: Mood,
  forceOverride: boolean
): Mood {
  if (forceOverride) return nextCandidate
  if (!previous) return nextCandidate
  // ~70% stick, ~30% accept new pick
  if (Math.random() < 0.7) return previous
  return nextCandidate
}

/** Strong user signals that should always recompute mood. */
export function moodForceFromUserText(text: string): boolean {
  return /\b(hurt|angry|pissed|hate|leave|miss you|love|need you|alone|scared|afraid|haha|lol|joke|tease)\b/i.test(
    text || ''
  )
}
