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

// Mood should create continuity, not trap a companion in a bad interpretation.
const TTL_MS = 45 * 60 * 1000

function isMood(value: string | null | undefined): value is Mood {
  return !!value && (VALID as string[]).includes(value)
}

/** Load a recent companion mood. Old moods should fade quickly in ordinary chat. */
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
  } catch (error) {
    // These columns may not exist in older environments. Mood continuity is optional.
    console.error('save mood', error)
  }
}

/**
 * Keep a little emotional continuity without allowing it to overrule the user.
 * Intense moods are deliberately less sticky because they are easier to misapply.
 */
export function continueMood(
  previous: Mood | null | undefined,
  nextCandidate: Mood,
  forceOverride: boolean
): Mood {
  if (forceOverride) return nextCandidate
  if (!previous) return nextCandidate
  if (previous === nextCandidate) return previous

  const intense =
    previous === 'guarded' ||
    previous === 'distant' ||
    previous === 'hungry_for_him' ||
    previous === 'sharp'

  const keepChance = intense ? 0.15 : 0.35
  return Math.random() < keepChance ? previous : nextCandidate
}

/**
 * Direct emotional statements and corrections must recompute mood immediately.
 * This includes positive corrections such as “I’m actually in a good mood.”
 */
export function moodForceFromUserText(text: string): boolean {
  return /\b(?:hurt|angry|pissed|hate|leave me alone|miss you|love you|need you|alone|scared|afraid|haha|lol|joking|tease|good mood|bad mood|i(?:'m| am| was| have been)\s+(?:actually\s+|really\s+|pretty\s+|relatively\s+)?(?:good|fine|okay|alright|happy|calm|content|upset|sad|tired|exhausted)|you (?:misread|read)|you(?:'re| are) reading|read that wrong|what(?:'s| is) with the (?:dark|heavy|sad) mood|no[,—-]?\s*(?:actually|i(?:'m| am| was| have been)))\b/i.test(
    text || ''
  )
}
