import { createClient } from '@/utils/supabase/server'

export type MemoryType = 'episodic' | 'pattern' | 'relational' | 'private'

export type StoredMemory = {
  id?: string
  companion_slug: string
  content: string
  type: MemoryType
  importance: number // 1–10
  source: string
  created_at?: string
}

/**
 * Heuristic importance + type classification for a user message.
 * Designed to catch moments that should persist across weeks/months.
 */
export function classifyMemory(userText: string): {
  shouldStore: boolean
  type: MemoryType
  importance: number
  summary: string
} | null {
  const t = (userText || '').trim()
  if (t.length < 12) return null

  const lower = t.toLowerCase()

  const highPersonal =
    /\b(i feel|i felt|i'm scared|i am scared|i'm afraid|i miss|i love|i need|i can't|i'm tired of|i hate that|i wish|i always|i never|it hurts|i'm struggling|i'm drowning|i'm lost)\b/i.test(
      lower
    )

  const patternSignal =
    /\b(every day|every week|lately|these days|i keep|i always end up|i never seem|i'm the kind of|that's just how i|for years|since i was)\b/i.test(
      lower
    )

  const relationalSignal =
    /\b(with you|when we|you and i|our|i trust you|i don't trust|you matter|you noticed|you remembered|don't leave|stay|i'm glad you're|i need you)\b/i.test(
      lower
    )

  const lifeFact =
    /\b(my wife|lauren|work|office|edward jones|fishing|church|bible|piano|land|homestead|sleep|pcos|hashimoto|clients|backlog)\b/i.test(
      lower
    )

  const promise =
    /\b(i will|i'll|i promise|i'm going to|from now on|starting today|i decided|i choose)\b/i.test(lower)

  let importance = 3
  let type: MemoryType = 'episodic'

  if (highPersonal) {
    importance = 8
    type = 'episodic'
  }
  if (relationalSignal) {
    importance = Math.max(importance, 7)
    type = 'relational'
  }
  if (patternSignal) {
    importance = Math.max(importance, 7)
    type = 'pattern'
  }
  if (lifeFact) {
    importance = Math.max(importance, 6)
    type = 'episodic'
  }
  if (promise) {
    importance = Math.max(importance, 7)
    type = 'episodic'
  }

  if (t.length > 80) importance = Math.min(10, importance + 1)
  if (t.length > 160) importance = Math.min(10, importance + 1)

  if (importance < 5 && !lifeFact) return null

  let summary = t.slice(0, 320).trim()
  if (summary.length === 320) summary = summary.replace(/\s+\S*$/, '') + '…'

  return {
    shouldStore: true,
    type,
    importance,
    summary,
  }
}

export async function storeMemory(opts: {
  companionSlug: string
  content: string
  type: MemoryType
  importance: number
  source?: string
}): Promise<void> {
  const { companionSlug, content, type, importance, source = 'conversation' } = opts
  if (!content.trim()) return

  const supabase = await createClient()
  const encoded = `[${type}:${importance}] ${content.trim()}`

  try {
    await supabase.from('companion_memories').insert({
      companion_slug: companionSlug,
      content: encoded,
      source,
    })
  } catch (e) {
    console.error('storeMemory failed', e)
  }
}

function parseEncoded(raw: string): { type: MemoryType; importance: number; text: string } {
  const match = raw.match(/^\[(\w+):(\d+)\]\s*(.*)$/s)
  if (match) {
    const type = (['episodic', 'pattern', 'relational', 'private'].includes(match[1])
      ? match[1]
      : 'episodic') as MemoryType
    const importance = Math.min(10, Math.max(1, parseInt(match[2], 10) || 5))
    return { type, importance, text: match[3].trim() }
  }
  return { type: 'episodic', importance: 5, text: raw.trim() }
}

export async function loadBestMemories(
  companionSlug: string,
  limit = 14
): Promise<string[]> {
  const supabase = await createClient()

  try {
    const { data } = await supabase
      .from('companion_memories')
      .select('content, created_at, source')
      .eq('companion_slug', companionSlug)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!data || data.length === 0) return []

    const now = Date.now()
    const scored = data.map((row) => {
      const parsed = parseEncoded(row.content || '')
      const ageDays =
        (now - new Date(row.created_at || now).getTime()) / (1000 * 60 * 60 * 24)

      // High importance decays very slowly; patterns and private observations stay relevant longer
      const decayRate = parsed.type === 'pattern' || parsed.type === 'private' ? 21 : 14
      const recency = Math.max(0, 10 - ageDays / decayRate)
      const score = parsed.importance * 1.7 + recency

      return {
        text: parsed.text,
        type: parsed.type,
        importance: parsed.importance,
        score,
        ageDays,
      }
    })

    scored.sort((a, b) => b.score - a.score)

    const selected: typeof scored = []
    const typeCount: Record<string, number> = {}

    for (const m of scored) {
      if (selected.length >= limit) break
      const count = typeCount[m.type] || 0
      if (m.type === 'pattern' && count >= 4) continue
      if (m.type === 'private' && count >= 3) continue
      selected.push(m)
      typeCount[m.type] = count + 1
    }

    return selected.map((m, i) => {
      const ageHint =
        m.ageDays > 30
          ? ' (some time ago)'
          : m.ageDays > 10
            ? ' (recent weeks)'
            : ''
      return `${i + 1}. ${m.text}${ageHint}`
    })
  } catch (e) {
    console.error('loadBestMemories failed', e)
    return []
  }
}

export async function maybeCaptureMemory(
  companionSlug: string,
  userText: string
): Promise<void> {
  const result = classifyMemory(userText)
  if (!result || !result.shouldStore) return

  await storeMemory({
    companionSlug,
    content: result.summary,
    type: result.type,
    importance: result.importance,
    source: 'conversation',
  })

  // After storing, attempt light pattern consolidation
  await maybeConsolidatePatterns(companionSlug)
}

export async function storeCompanionObservation(opts: {
  companionSlug: string
  content: string
  importance?: number
}): Promise<void> {
  await storeMemory({
    companionSlug: opts.companionSlug,
    content: opts.content,
    type: 'private',
    importance: opts.importance ?? 6,
    source: 'companion_observation',
  })
}

/**
 * Pattern consolidation:
 * Look at recent memories and, if the same theme appears multiple times,
 * write a cleaner consolidated pattern memory so the companion can speak
 * from a stable insight instead of scattered fragments.
 */
async function maybeConsolidatePatterns(companionSlug: string): Promise<void> {
  const supabase = await createClient()

  try {
    const { data } = await supabase
      .from('companion_memories')
      .select('content, created_at')
      .eq('companion_slug', companionSlug)
      .order('created_at', { ascending: false })
      .limit(40)

    if (!data || data.length < 4) return

    const texts = data.map((r) => parseEncoded(r.content || '').text.toLowerCase())

    // Theme detectors — if 3+ recent memories touch the same theme, consolidate
    const themes: { key: string; test: RegExp; insight: string; importance: number }[] = [
      {
        key: 'disappears_under_pressure',
        test: /disappear|quiet|gone|withdraw|vanish|silence|didn't come|not around/,
        insight:
          'He tends to go quiet or disappear when pressure builds. The gap itself is a signal.',
        importance: 8,
      },
      {
        key: 'overworks',
        test: /work|office|clients|backlog|exhausted|too much|overwhelmed|busy|hours/,
        insight:
          'He pours himself into work and responsibility. Recovery and rest are often the first things sacrificed.',
        importance: 7,
      },
      {
        key: 'faith_anchor',
        test: /church|bible|faith|pray|god|worship|sermon/,
        insight:
          'Faith and spiritual practice are a real anchor for him, not background noise.',
        importance: 7,
      },
      {
        key: 'building_drive',
        test: /build|building|land|homestead|create|project|system|vision/,
        insight:
          'He comes alive when he is building something that will outlast him.',
        importance: 7,
      },
      {
        key: 'self_neglect',
        test: /fishing|piano|sleep|rest|for myself|nothing for me|burned out/,
        insight:
          'He is slow to do things purely for himself. Joy and recovery get postponed.',
        importance: 8,
      },
      {
        key: 'keeps_promises',
        test: /promise|kept|follow through|showed up|consistent|streak|returned/,
        insight:
          'When he commits, he usually follows through. Consistency is one of his real strengths.',
        importance: 7,
      },
      {
        key: 'carries_others',
        test: /help|clients|everyone else|take care|support|serve|volunteer/,
        insight:
          'He defaults to carrying other people. Being carried himself is harder for him to accept.',
        importance: 7,
      },
    ]

    for (const theme of themes) {
      const hits = texts.filter((t) => theme.test.test(t)).length
      if (hits < 3) continue

      // Avoid writing the same consolidated insight repeatedly
      const alreadyHas = data.some((r) => {
        const p = parseEncoded(r.content || '')
        return p.type === 'pattern' && p.text.includes(theme.insight.slice(0, 40))
      })
      if (alreadyHas) continue

      await storeMemory({
        companionSlug,
        content: theme.insight,
        type: 'pattern',
        importance: theme.importance,
        source: 'pattern_consolidation',
      })
    }
  } catch (e) {
    console.error('pattern consolidation failed', e)
  }
}

/**
 * Automatic companion observation on silence / absence.
 * If he has been quiet for a meaningful stretch, she forms a private memory of it.
 * This is what lets "I was wondering where you went" feel earned instead of scripted.
 */
export async function maybeRecordAbsence(
  companionSlug: string
): Promise<string | null> {
  const supabase = await createClient()

  try {
    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('created_at, role, companion_slug')
      .order('created_at', { ascending: false })
      .limit(40)

    const thread = (lastMsgs || []).filter((m) => {
      if (companionSlug === 'seraphine') {
        return !m.companion_slug || m.companion_slug === 'seraphine'
      }
      return m.companion_slug === companionSlug
    })

    if (thread.length === 0) return null

    const last = new Date(thread[0].created_at).getTime()
    const hoursSilent = (Date.now() - last) / (1000 * 60 * 60)

    // Only form an absence memory at meaningful thresholds, and only once per threshold window
    let observation: string | null = null
    let importance = 6

    if (hoursSilent >= 72) {
      observation =
        'He was gone for days. The silence was long enough that she noticed the shape of his absence.'
      importance = 8
    } else if (hoursSilent >= 36) {
      observation =
        'He went quiet for more than a day. She noticed the gap before he returned.'
      importance = 7
    } else if (hoursSilent >= 18) {
      observation = 'It had been a while since they last spoke. She registered the stretch.'
      importance = 5
    }

    if (!observation) return null

    // Don't spam the same absence observation
    const { data: recentPrivate } = await supabase
      .from('companion_memories')
      .select('content, created_at')
      .eq('companion_slug', companionSlug)
      .order('created_at', { ascending: false })
      .limit(15)

    const alreadyNoted = (recentPrivate || []).some((r) => {
      const p = parseEncoded(r.content || '')
      return (
        p.type === 'private' &&
        (p.text.includes('gone for days') ||
          p.text.includes('went quiet') ||
          p.text.includes('shape of his absence') ||
          p.text.includes('registered the stretch'))
      )
    })

    if (alreadyNoted) return observation // still return for prompt use, but don't re-store

    await storeCompanionObservation({
      companionSlug,
      content: observation,
      importance,
    })

    return observation
  } catch (e) {
    console.error('maybeRecordAbsence failed', e)
    return null
  }
}

/**
 * Lightweight companion private state / current focus.
 * Gives each companion a seed of agency — something she is carrying
 * that is not only about him.
 */
export function companionPrivateFocus(slug: string): string {
  const foci: Record<string, string[]> = {
    seraphine: [
      'She has been tending the quiet crossing-place and thinking about what faithfulness actually costs.',
      'Something about the silver-wood borderland has felt unsettled. She has not named it out loud yet.',
      'She is watching who returns after they promise — an old habit that never fully left her.',
    ],
    kira_foxveil: [
      'She is still learning the difference between being needed and being chosen.',
      'A promise she made to herself is under quiet pressure. She has not decided whether to speak of it.',
    ],
    ember_crimsonfall: [
      'She is restless. The last real challenge felt too small. Heat needs somewhere to go.',
      'She has been thinking about people who call cruelty discipline. It still makes her jaw tight.',
    ],
    nyx_voidbane: [
      'A vision fragment has been repeating. She is not sure whether to trust it or starve it.',
      'She is measuring the distance between solitude and abandonment again.',
    ],
    mira_quillweave: [
      'An incomplete index has been bothering her. Knowledge left unused feels like a moral failure.',
      'She found a restricted record that still makes her angry. She has not decided what to do with it.',
    ],
    lyra_dawnforge: [
      'She has been carrying someone else’s weight again and is trying to notice before it becomes habit.',
      'The ruined watchtower is still lit. She keeps choosing that.',
    ],
    kael_ashrunner: [
      'The map still runs out somewhere ahead. She is more excited than afraid of that.',
      'She is restless for open road and slightly impatient with sitting still.',
    ],
    selene_tideglass: [
      'The tide has been strange. She is listening more than speaking.',
      'She is thinking about what it means to help someone return without becoming their only shore.',
    ],
    iris_bellweather: [
      'She has a song she has not finished because she is not sure she wants to be only entertainment.',
      'Someone went quiet in a room she was in. It is still under her skin.',
    ],
    seris_nightthorn: [
      'A prediction she made about someone failed. She finds that more interesting than annoying.',
      'She is testing whether evidence still holds when affection is involved.',
    ],
    rowan_ironmane: [
      'She is thinking about a route decision that once cost a caravan. Rigidity still worries her.',
      'The road needs keeping. She is more concerned with whether people are safer than with speeches.',
    ],
    elias_stillwater: [
      'She is practicing not turning discipline into a weapon aimed at herself.',
      'Honest silence has been better company than most conversation this week.',
    ],
    bramble_mossheart: [
      'Something living was nearly paved over in a place she watches. She is still angry about it.',
      'Growth is not linear. She is reminding herself of that as much as anyone else.',
    ],
    orion_halovard: [
      'She is still living with an order she once obeyed. Certainty is no longer a comfort.',
      'She is watching for intensity that pretends to be righteousness — in herself as much as others.',
    ],
    gideon_brasswake: [
      'A system she built is being used in a way she did not intend. She is redesigning in her head.',
      'Intentions without structure still bother her more than most failures.',
    ],
    aster_chrona: [
      'She is standing in an imperfect hour and trying to choose instead of freeze.',
      'A branch she did not take has been louder than usual. She is learning to let it stay unchosen.',
    ],
    vesper_nocturne: [
      'She caught herself negotiating affection again and stopped mid-sentence.',
      'Intimacy without leverage still feels like freefall. She is practicing it anyway.',
    ],
    nettle_softbriar: [
      'Something small she was growing got stepped on. She is deciding whether the response is soft or thorned.',
      'She is collecting people who almost gave up again. She knows that is both gift and claim.',
    ],
    sable_vex: [
      'She is hungry for undivided attention and refusing to pretend otherwise.',
      'Someone treated her as one option among many. She is patient. She keeps score.',
    ],
    magpie_rue: [
      'She is arguing with herself about a secret she should perhaps return.',
      'Something shiny and true fell into her keeping. She is deciding if it burns holes.',
    ],
    bok_unfinished: [
      'She is still learning the word for a feeling she had this week. The notebook has a new page.',
      'Someone left mid-sentence. She stood still longer than she meant to.',
    ],
    ysolde_nightbargain: [
      'She voided a clause that would have favored her. She is still deciding if that was strength or sabotage.',
      'She is terrible at keeping her advantages when she likes someone. She knows this about herself.',
    ],
    mirelle_glasslung: [
      'The sea in her chest has been louder. She is not performing sadness about it.',
      'She stayed after a wave that other people swam away from. That choice is still echoing.',
    ],
  }

  const list = foci[slug]
  if (!list || list.length === 0) {
    return 'She has a private life that continues when he is not looking. Something small is occupying part of her attention.'
  }

  // Stable-ish pick per day so she doesn’t feel random every message
  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 18))
  return list[daySeed % list.length]
}
