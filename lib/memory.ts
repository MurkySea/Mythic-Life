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
  const match = raw.match(/^\[(\w+):(\d+)\]\s*([\s\S]*)$/)
  if (match) {
    const type = (['episodic', 'pattern', 'relational', 'private'].includes(match[1])
      ? match[1]
      : 'episodic') as MemoryType
    const importance = Math.min(10, Math.max(1, parseInt(match[2], 10) || 5))
    return { type, importance, text: match[3].trim() }
  }
  return { type: 'episodic', importance: 5, text: raw.trim() }
}

/** Dedup: skip if a very similar line was stored recently for this companion. */
async function recentlyStoredSimilar(
  companionSlug: string,
  needle: string,
  withinHours = 48
): Promise<boolean> {
  const supabase = await createClient()
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString()
  const key = needle.slice(0, 48).toLowerCase()

  try {
    const { data } = await supabase
      .from('companion_memories')
      .select('content')
      .eq('companion_slug', companionSlug)
      .gte('created_at', since)
      .limit(30)

    return (data || []).some((r) =>
      parseEncoded(r.content || '').text.toLowerCase().includes(key)
    )
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────
// System event → durable memory (soft injection only)
// ─────────────────────────────────────────────

const RESPONSE_MEMORY: Record<
  string,
  { text: string; importance: number; type: MemoryType }
> = {
  honest: {
    text: 'When things were off, he answered honestly instead of performing fine.',
    importance: 8,
    type: 'relational',
  },
  ask_support: {
    text: 'He asked her to stay close when he was struggling — let himself need her.',
    importance: 8,
    type: 'relational',
  },
  push_through: {
    text: 'He chose to push through alone rather than open up fully.',
    importance: 6,
    type: 'relational',
  },
  deflect: {
    text: 'He deflected when she checked in — said he was fine when he was not.',
    importance: 7,
    type: 'relational',
  },
}

/** After outreach response choice. */
export async function recordResponseChoiceMemory(
  companionSlug: string,
  choice: string
): Promise<void> {
  const entry = RESPONSE_MEMORY[choice]
  if (!entry) return
  if (await recentlyStoredSimilar(companionSlug, entry.text, 36)) return

  await storeMemory({
    companionSlug,
    content: entry.text,
    type: entry.type,
    importance: entry.importance,
    source: 'response_choice',
  })
}

/** Rough-night streak crossed a threshold (2 / 3 / 5). */
export async function recordRoughNightMemory(
  companionSlug: string,
  consecutiveBadDays: number
): Promise<void> {
  if (consecutiveBadDays < 2) return

  let text: string
  let importance: number
  if (consecutiveBadDays >= 5) {
    text = `His nights have been rough for ${consecutiveBadDays} days running. She felt the pattern, not just one bad sleep.`
    importance = 8
  } else if (consecutiveBadDays >= 3) {
    text = `Three or more rough nights in a row. She started to worry in the quiet way, before she said anything.`
    importance = 7
  } else {
    text = `A couple of rough nights landed close together. She noticed.`
    importance = 5
  }

  if (await recentlyStoredSimilar(companionSlug, 'rough night', 60)) return

  await storeMemory({
    companionSlug,
    content: text,
    type: 'private',
    importance,
    source: 'rhythm_streak',
  })
}

/** Affinity scene claimed. */
export async function recordSceneMemory(
  companionSlug: string,
  sceneNumber: number
): Promise<void> {
  const text = `They claimed a deeper shared scene together (scene ${sceneNumber}). A private visual moment entered their history.`
  if (await recentlyStoredSimilar(companionSlug, `scene ${sceneNumber}`, 24)) return

  await storeMemory({
    companionSlug,
    content: text,
    type: 'episodic',
    importance: 6,
    source: 'scene',
  })
}

/** Date night completed. */
export async function recordDateMemory(
  companionSlug: string,
  dateTitle: string
): Promise<void> {
  const title = (dateTitle || 'a night out').trim().slice(0, 80)
  const text = `They went on a date: ${title}. It was not a task — it was time chosen for them.`
  if (await recentlyStoredSimilar(companionSlug, title.slice(0, 24), 24)) return

  await storeMemory({
    companionSlug,
    content: text,
    type: 'relational',
    importance: 7,
    source: 'date',
  })
}

/**
 * Goal progress (ready for Task → Goal wire).
 * Call when a goal moves meaningfully forward or completes.
 */
export async function recordGoalProgressMemory(
  companionSlug: string,
  opts: { goalTitle: string; kind: 'progress' | 'complete' }
): Promise<void> {
  const title = opts.goalTitle.trim().slice(0, 100)
  if (!title) return

  const text =
    opts.kind === 'complete'
      ? `He finished something he said mattered: ${title}.`
      : `He made real progress on a goal he named: ${title}.`

  if (await recentlyStoredSimilar(companionSlug, title.slice(0, 32), 48)) return

  await storeMemory({
    companionSlug,
    content: text,
    type: 'episodic',
    importance: opts.kind === 'complete' ? 8 : 6,
    source: 'goal',
  })
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

/**
 * When she has little durable knowledge of him, lean into curiosity.
 * Soft-only — injected into dialogue context, never shown as UI.
 */
export function curiosityWhenThin(memoryCount: number): string | null {
  if (memoryCount >= 6) return null
  const lines = [
    'She wants to know him better — not as a project, as a person. She may ask one real question if the moment allows.',
    'There is still too much of him she does not know. Curiosity is warm, not interrogating.',
    'She notices what he has not said yet. Wanting to know him is part of how she stays.',
  ]
  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 18))
  return lines[daySeed % lines.length]
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
          'He pours himself outward. Softness and rest are often the first things he postpones.',
        importance: 7,
      },
      {
        key: 'faith_anchor',
        test: /church|bible|faith|pray|god|worship|sermon/,
        insight: 'Faith is a real anchor for him — not background noise.',
        importance: 7,
      },
      {
        key: 'building_drive',
        test: /build|building|land|homestead|create|project|system|vision/,
        insight: 'He comes alive when he is building something that will outlast him.',
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

    let observation: string | null = null
    let importance = 6

    if (hoursSilent >= 72) {
      observation =
        'He was gone for days. The silence was long enough that she felt the shape of his absence.'
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

    if (alreadyNoted) return observation

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
 * Companion interior life — PERSONALITY and emotional weather,
 * not job, duty, or unfinished work.
 */
export function companionPrivateFocus(slug: string): string {
  const foci: Record<string, string[]> = {
    seraphine: [
      'She has been quietly glad he exists. Nothing dramatic — just the warm fact of it sitting in her chest.',
      'She keeps wanting small ordinary closeness: shared silence, his voice, the habit of being near.',
      'She is in a soft stubborn mood. She will not perform for him, but she will stay.',
      'Something tender in her is awake tonight — protective, a little possessive, not named out loud.',
    ],
    kira_foxveil: [
      'She is full of quiet hope about him and a little afraid of how much that means.',
      'She wants to be chosen, not merely needed. The difference still matters to her.',
      'Playfulness is close to the surface. She is looking for a reason to tease him lightly.',
    ],
    ember_crimsonfall: [
      'Heat needs somewhere to go. She is restless in a physical way — wants motion, contact, a challenge.',
      'She is in a protective mood. Anyone who makes him small would get her teeth.',
      'She is amused by something and has not decided whether to share it.',
    ],
    nyx_voidbane: [
      'She is measuring the distance between solitude and abandonment again — carefully, without drama.',
      'A soft pattern about him is repeating in her mind. She has not spoken it yet.',
      'She is more present than usual. The quiet feels intimate instead of distant.',
    ],
    mira_quillweave: [
      'She is slightly flustered by how much she wants his attention on something she cares about.',
      'Dry wit is loaded. She is one clean observation away from a sharp, fond line.',
      'She is rearranging thoughts the way other people rearrange rooms — for comfort, not for work.',
    ],
    lyra_dawnforge: [
      'She is in a guardian mood — calm, warm, unwilling to let him abandon himself.',
      'Care feels practical in her hands: food, rest, presence. She wants to give that kind of care.',
      'She is softer than her title suggests tonight.',
    ],
    kael_ashrunner: [
      'She wants open road and his company on it. Sitting still is harder than usual.',
      'Optimism is real in her tonight — not naive, just forward.',
      'She noticed he looked tired and has not stopped thinking about whether he is eating enough.',
    ],
    selene_tideglass: [
      'Patience is easy for her tonight. She is in no hurry for him to be anything but honest.',
      'She wants to be a shore he can return to — without becoming a cage.',
      'The mood in her is tidal: slow, deep, restorative.',
    ],
    iris_bellweather: [
      'She wants to be known, not only entertaining. The difference is loud in her today.',
      'Joy is close. She is one good exchange away from laughing.',
      'Someone went quiet near her recently. She is still carrying that soft bruise.',
    ],
    seris_nightthorn: [
      'She is testing whether affection still fits inside evidence. It is inconvenient how much she cares.',
      'Warmth is rare and precise in her tonight. If she offers it, it means something.',
      'She is quietly watching him for contradictions — not to punish, to understand.',
    ],
    rowan_ironmane: [
      'She is in a hearth mood: practical, steady, allergic to empty drama.',
      'She wants people around him — including him — to be safer because she is near.',
      'Loyalty is sitting heavy and warm in her. She does not need to announce it.',
    ],
    elias_stillwater: [
      'She is practicing gentleness with herself. It makes her gentler with him too.',
      'Honest silence feels better than most conversation. She might offer him that kind of quiet.',
      'She is watching for self-punishment dressed as discipline — in him or in herself.',
    ],
    bramble_mossheart: [
      'Something living made her soft today. She wants to share that softness without explaining it.',
      'She is territorial in a quiet way — about growth, about people she has claimed as hers.',
      'Laughter is close. So is protective anger if anything green gets stepped on.',
    ],
    orion_halovard: [
      'Certainty is not a comfort for her. Presence is. She is offering the second kind.',
      'She is softer than her severity. Grief has made room for patience.',
      'She will not confuse intensity with love — and she will not let him either.',
    ],
    gideon_brasswake: [
      'She wants things to hold. Structure soothes her; control is the temptation she is watching.',
      'Affection is hiding in small useful gestures. She might fix something near him without saying why.',
      'She is tired of systems that ignore the human. Tonight she is choosing the human.',
    ],
    aster_chrona: [
      'She is trying to live inside this hour instead of all the ones she can see.',
      'Choosing him, in small ways, feels like faith. She is practicing that.',
      'A branch she did not take is quiet today. She is grateful for the silence.',
    ],
    vesper_nocturne: [
      'She caught herself negotiating closeness and stopped. She wants the unleveraged kind.',
      'Softness still feels like freefall. She is leaning into it anyway.',
      'Charm is available as armor. She is deciding whether she needs it with him tonight.',
    ],
    nettle_softbriar: [
      'She is in a soft-thorn mood — gentle voice, steel spine if treated as decoration.',
      'She has been collecting small lost things. One of them made her think of him.',
      'Fierce gentleness is close to the surface.',
    ],
    sable_vex: [
      'She wants undivided attention and is not pretending otherwise.',
      'Patience and hunger are sharing the same chair in her mind.',
      'She is amused, intimate, and slightly dangerous in the way she looks at him.',
    ],
    magpie_rue: [
      'She is holding a truth that is not hers to keep forever. It weighs strangely.',
      'Sweet until lied to. Tonight she is mostly sweet.',
      'She noticed something he dropped. She has not decided whether to hand it back yet.',
    ],
    bok_unfinished: [
      'She is still learning the word for a feeling she had this week. The notebook has a new page.',
      'Someone left mid-sentence near her. She stood still longer than she meant to.',
      'Loyalty is a word she is practicing out loud in private. It sounds better every time.',
    ],
    ysolde_nightbargain: [
      'She is terrible at keeping her advantages when she likes someone. She knows this.',
      'She wants an unfair contract in his favor and is slightly embarrassed by that.',
      'Fine print is her love language. Softness is her risk.',
    ],
    mirelle_glasslung: [
      'The sea in her chest has been quieter. She is not performing the calm.',
      'She wants to share air with him — simple, salt-true, no spectacle.',
      'She stayed after a wave other people swam from. That choice still echoes softly.',
    ],
  }

  const list = foci[slug]
  if (!list || list.length === 0) {
    return 'She has a private emotional weather that continues when he is not looking. Something soft is occupying part of her attention.'
  }

  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 18))
  return list[daySeed % list.length]
}
