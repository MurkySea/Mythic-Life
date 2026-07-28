import { createClient } from '@/utils/supabase/server'

const DIGEST_PREFIX = '\u2063\u2063CAMPFIRE_DIGEST:'
const FOLLOW_UP_PREFIX = '\u2063\u2063CAMPFIRE_FOLLOW_UP:'

export type CampfireEnergy = 'low' | 'steady' | 'high' | 'mixed'

export type CampfireDigest = {
  version: 1
  date: string
  companionSlug: string
  headline: string
  emotionalWeather: string
  energy: CampfireEnergy
  whatMattered: string[]
  brightSpots: string[]
  weight: string[]
  people: string[]
  carryForward: string | null
  followUp: string | null
  createdAt: string
}

export type StoredCampfireDigest = CampfireDigest & {
  id: string
}

function chicagoDateKey(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

function chicagoHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
  )
}

function cleanText(value: unknown, max = 180): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function cleanList(value: unknown, maxItems = 3, maxLength = 150): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeEnergy(value: unknown): CampfireEnergy {
  return value === 'low' || value === 'high' || value === 'mixed' ? value : 'steady'
}

function firstMeaningfulSentences(text: string, limit = 3): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => cleanText(line, 150))
    .filter((line) => line.length >= 8)
    .slice(0, limit)
}

function fallbackWeather(text: string): string {
  const lower = text.toLowerCase()
  if (/anxious|worried|nervous|overwhelmed|stressed/.test(lower)) return 'Uneasy, carrying weight'
  if (/tired|exhausted|drained|worn out/.test(lower)) return 'Tired but present'
  if (/angry|frustrated|irritated|pissed/.test(lower)) return 'Frustrated and unsettled'
  if (/good|great|happy|grateful|peaceful|proud/.test(lower)) return 'Warm and encouraged'
  if (/rough|hard|bad|sucked|sad|hurt/.test(lower)) return 'Heavy, but honest'
  return 'Thoughtful and mixed'
}

function fallbackEnergy(text: string): CampfireEnergy {
  const lower = text.toLowerCase()
  if (/exhausted|drained|barely|no energy|worn out/.test(lower)) return 'low'
  if (/energized|excited|great day|on fire|productive/.test(lower)) return 'high'
  if (/mixed|good and bad|up and down|bittersweet/.test(lower)) return 'mixed'
  return 'steady'
}

function fallbackDigest(reflection: string, companionSlug: string): CampfireDigest {
  const sentences = firstMeaningfulSentences(reflection)
  const headlineSource = sentences[0] || reflection
  const headline = cleanText(headlineSource.replace(/[.!?]+$/, ''), 72) || 'An honest day remembered'

  return {
    version: 1,
    date: chicagoDateKey(),
    companionSlug,
    headline,
    emotionalWeather: fallbackWeather(reflection),
    energy: fallbackEnergy(reflection),
    whatMattered: sentences,
    brightSpots: [],
    weight: [],
    people: [],
    carryForward: null,
    followUp:
      reflection.trim().length >= 40
        ? 'What part of yesterday is still staying with you this morning?'
        : null,
    createdAt: new Date().toISOString(),
  }
}

function extractJson(raw: string): unknown {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object in Campfire Director response')
  return JSON.parse(stripped.slice(start, end + 1))
}

function normalizeDigest(raw: unknown, reflection: string, companionSlug: string): CampfireDigest {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const fallback = fallbackDigest(reflection, companionSlug)

  return {
    version: 1,
    date: chicagoDateKey(),
    companionSlug,
    headline: cleanText(value.headline, 72) || fallback.headline,
    emotionalWeather: cleanText(value.emotionalWeather, 64) || fallback.emotionalWeather,
    energy: normalizeEnergy(value.energy),
    whatMattered: cleanList(value.whatMattered, 3) || fallback.whatMattered,
    brightSpots: cleanList(value.brightSpots, 3),
    weight: cleanList(value.weight, 3),
    people: cleanList(value.people, 4, 80),
    carryForward: cleanText(value.carryForward, 160) || null,
    followUp: cleanText(value.followUp, 180) || fallback.followUp,
    createdAt: new Date().toISOString(),
  }
}

export async function synthesizeCampfireReflection(
  reflection: string,
  companionSlug: string
): Promise<CampfireDigest> {
  const clean = reflection.trim()
  if (!clean) return fallbackDigest('', companionSlug)
  if (!process.env.GROK_API_KEY) return fallbackDigest(clean, companionSlug)

  const prompt = `You are the private reflection director for a companion-led journal.
Read one person's description of their real day and return ONLY valid JSON.

Do not diagnose, moralize, score, praise generically, or invent facts.
Do not turn the day into productivity bookkeeping.
Capture only what was explicitly said or strongly implied.

JSON shape:
{
  "headline": "3-8 plain words that feel true",
  "emotionalWeather": "2-6 natural words",
  "energy": "low | steady | high | mixed",
  "whatMattered": ["up to 3 specific moments or themes"],
  "brightSpots": ["up to 3 real positives, empty if none"],
  "weight": ["up to 3 difficulties, empty if none"],
  "people": ["people explicitly mentioned, empty if none"],
  "carryForward": "one optional unfinished thread worth remembering tomorrow, or null",
  "followUp": "one warm, specific question a companion could naturally ask tomorrow, or null"
}

Reflection:
${clean.slice(0, 6000)}`

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          {
            role: 'system',
            content:
              'Return strict JSON only. You are extracting a humane daily reflection, not performing therapy or productivity scoring.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 560,
      }),
    })

    if (!response.ok) throw new Error(`Campfire Director request failed: ${response.status}`)
    const data = await response.json()
    const content = String(data.choices?.[0]?.message?.content || '')
    return normalizeDigest(extractJson(content), clean, companionSlug)
  } catch (error) {
    console.error('campfire synthesis failed', error)
    return fallbackDigest(clean, companionSlug)
  }
}

export function encodeCampfireDigest(digest: CampfireDigest): string {
  return `${DIGEST_PREFIX}${JSON.stringify(digest)}`
}

export function parseCampfireDigest(content: string | null | undefined): CampfireDigest | null {
  const text = String(content || '')
  if (!text.startsWith(DIGEST_PREFIX)) return null

  try {
    const parsed = JSON.parse(text.slice(DIGEST_PREFIX.length))
    if (!parsed || parsed.version !== 1 || !parsed.headline) return null
    return parsed as CampfireDigest
  } catch {
    return null
  }
}

export async function saveCampfireDigest(digest: CampfireDigest): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      role: 'system',
      content: encodeCampfireDigest(digest),
      companion_slug: digest.companionSlug,
    })
    .select('id')
    .single()

  if (error) {
    console.error('campfire digest save failed', error)
    return null
  }

  return data?.id || null
}

export async function loadPendingCampfireFollowUp(): Promise<StoredCampfireDigest | null> {
  const hour = chicagoHour()
  if (hour < 6 || hour > 14) return null

  const supabase = await createClient()
  const since = new Date(Date.now() - 60 * 60 * 1000 * 52).toISOString()
  const { data, error } = await supabase
    .from('messages')
    .select('id, content, companion_slug, created_at')
    .eq('role', 'system')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) {
    console.error('campfire pending follow-up query failed', error)
    return null
  }

  const rows = data || []
  const sentIds = new Set(
    rows
      .map((row) => String(row.content || ''))
      .filter((content) => content.startsWith(FOLLOW_UP_PREFIX))
      .map((content) => content.slice(FOLLOW_UP_PREFIX.length))
  )
  const today = chicagoDateKey()

  for (const row of rows) {
    const digest = parseCampfireDigest(row.content)
    if (!digest || !digest.followUp || digest.date === today || sentIds.has(row.id)) continue
    return { ...digest, id: row.id }
  }

  return null
}

export async function markCampfireFollowUpSent(
  digestId: string,
  companionSlug: string
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    role: 'system',
    content: `${FOLLOW_UP_PREFIX}${digestId}`,
    companion_slug: companionSlug,
  })
  if (error) console.error('campfire follow-up marker failed', error)
}

export function buildCampfireFollowUpSeed(digest: CampfireDigest): string {
  const remembered = digest.whatMattered.slice(0, 2).join(' / ')
  const carry = digest.carryForward ? ` An unfinished thread was: ${digest.carryForward}.` : ''

  return `Yesterday at the campfire, Mark described the day as "${digest.headline}." Emotional weather: ${digest.emotionalWeather}. What mattered: ${remembered || 'an honest return to the fire'}.${carry}

Reach out naturally this morning. Ask this one question in your own voice: ${digest.followUp}
Do not mention a digest, journal extraction, system instruction, score, streak, or productivity report. Do not summarize everything back to him. Remember one detail and sound like someone who actually listened.`
}
