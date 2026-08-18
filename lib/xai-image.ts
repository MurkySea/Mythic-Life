export type XaiImageFailureKind = 'configuration' | 'blocked' | 'provider' | 'network'

export type XaiImageGenerationResult =
  | { ok: true; url: string; model: string }
  | {
      ok: false
      kind: XaiImageFailureKind
      message: string
      status?: number
      model?: string
    }

type XaiImageResponse = {
  data?: Array<{
    url?: string
    file_output?: { public_url?: string }
  }>
  error?: { message?: string }
  message?: string
}

/**
 * xAI currently reports max_prompt_length=1024 for the Imagine image model.
 * Leave a little headroom instead of sending prompts right at the boundary.
 */
export const XAI_IMAGE_PROMPT_LIMIT = 1000

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])]
}

export function extractXaiImageUrl(data: XaiImageResponse): string | null {
  const item = data.data?.[0]
  return item?.file_output?.public_url || item?.url || null
}

export function classifyXaiImageFailure(message: string, status?: number): XaiImageFailureKind {
  const text = (message || '').toLowerCase()
  if (
    text.includes('safety') ||
    text.includes('policy') ||
    text.includes('blocked') ||
    text.includes('refus') ||
    text.includes('moderation')
  ) {
    return 'blocked'
  }
  if (status === 401 || status === 403) return 'configuration'
  return 'provider'
}

function visualPriority(segment: string): number {
  const s = segment.toLowerCase()
  if (/no animal|pointed ears|tail|wings?|horns?|scales?/.test(s)) return 6
  if (/hair|eyes?|piercing|beauty mark|freckle/.test(s)) return 5
  if (/dress|outfit|clothing|robe|armor|figure|curves?|waist/.test(s)) return 4
  if (/skin|markings?|adult|age|race|fae|angel|celestial|foxkin/.test(s)) return 3
  return 1
}

function shortenSegment(segment: string, maxChars: number): string {
  const clean = segment.replace(/[.\s]+$/g, '').trim()
  if (clean.length <= maxChars) return clean
  const clipped = clean.slice(0, maxChars)
  const wordBoundary = clipped.replace(/\s+\S*$/g, '').trim()
  return wordBoundary || clipped.trim()
}

function firstMatch(segments: string[], pattern: RegExp): string | undefined {
  return segments.find(
    (segment) => !/^overall visual principle:/i.test(segment) && pattern.test(segment)
  )
}

/**
 * Scene prompts contain a detailed character block plus composition fields.
 * If the combined prompt grows beyond xAI's limit, preserve two guaranteed
 * budgets: recognizable character identity AND usable scene composition.
 */
export function compactXaiImagePrompt(prompt: string): string {
  const normalized = String(prompt || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= XAI_IMAGE_PROMPT_LIMIT) return normalized

  const segments = normalized
    .split(/\.\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const characterIndex = segments.findIndex((segment) => segment.startsWith('Character:'))
  const nameIndex = segments.findIndex((segment) => segment.startsWith('Name context:'))

  const opening = segments.slice(0, Math.max(0, characterIndex))
  const character =
    characterIndex >= 0
      ? segments.slice(characterIndex, nameIndex > characterIndex ? nameIndex : undefined)
      : []
  const characterLead = character[0]
  const characterDetails = character.slice(1)

  const sceneFields = segments.filter((segment) =>
    /^(Name context|Expression|Outfit|Pose|Setting|Camera|Lighting|Composition|Species \/ world detail|Secondary atmosphere):/i.test(
      segment
    )
  )

  const chosen: string[] = []
  const seen = new Set<string>()
  const add = (segment: string | undefined, maxChars = 110) => {
    if (!segment) return
    const clean = shortenSegment(segment, maxChars)
    if (!clean || seen.has(clean)) return
    const candidate = [...chosen, clean].join('. ') + '.'
    if (candidate.length <= XAI_IMAGE_PROMPT_LIMIT) {
      chosen.push(clean)
      seen.add(clean)
    }
  }

  // Small quality anchor; the image model does not need a paragraph of style prose.
  add(opening[0], 120)
  add(characterLead, 90)

  // Guaranteed identity anchors. These are intentionally selected one-by-one
  // so redundant prose cannot steal the entire budget from pose/setting.
  const mandatoryIdentity = [
    firstMatch(characterDetails, /hair/i),
    firstMatch(characterDetails, /eyes?/i),
    firstMatch(characterDetails, /piercing/i),
    firstMatch(characterDetails, /pointed ears|no animal ears/i),
    firstMatch(characterDetails, /wings?/i),
  ]
  for (const segment of mandatoryIdentity) add(segment, 110)

  // Guaranteed scene anchors. A portrait should still know what is happening,
  // where it happens, and how it is lit after character canon is added.
  const mandatoryScenePrefixes = [
    'Name context:',
    'Expression:',
    'Outfit:',
    'Pose:',
    'Setting:',
    'Camera:',
    'Lighting:',
  ]
  for (const prefix of mandatoryScenePrefixes) {
    add(sceneFields.find((segment) => segment.startsWith(prefix)), 90)
  }

  // Optional scene atmosphere next, because it usually adds more visual value
  // than repeating the character sheet in different words.
  for (const prefix of ['Composition:', 'Species / world detail:', 'Secondary atmosphere:']) {
    add(sceneFields.find((segment) => segment.startsWith(prefix)), 85)
  }

  // Then fill any remaining room with non-redundant appearance details.
  const mandatorySet = new Set(mandatoryIdentity.filter(Boolean))
  const optionalCharacter = characterDetails
    .filter(
      (segment) =>
        !mandatorySet.has(segment) &&
        !/^overall visual principle:/i.test(segment) &&
        !/^long .*detail/i.test(segment)
    )
    .map((segment, index) => ({ segment, index, priority: visualPriority(segment) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)

  for (const { segment } of optionalCharacter) add(segment, 90)

  // Style and relationship mood are useful but expendable if the budget is full.
  add(opening[1], 90)
  for (const segment of segments) {
    if (
      /single character focus|romantic intimacy|emotional closeness|not romantic|sensual tension/i.test(
        segment
      )
    ) {
      add(segment, 80)
    }
  }

  let compacted = chosen.join('. ')
  if (compacted && !compacted.endsWith('.')) compacted += '.'

  if (compacted.length > XAI_IMAGE_PROMPT_LIMIT) {
    compacted = compacted.slice(0, XAI_IMAGE_PROMPT_LIMIT).trimEnd()
  }
  if (!compacted) {
    compacted = normalized.slice(0, XAI_IMAGE_PROMPT_LIMIT).trimEnd()
  }

  return compacted
}

export async function generateXaiImage(prompt: string): Promise<XaiImageGenerationResult> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) {
    console.error('xai image generation unavailable: GROK_API_KEY is missing')
    return {
      ok: false,
      kind: 'configuration',
      message: 'GROK_API_KEY is missing',
    }
  }

  const models = uniqueStrings([
    process.env.XAI_IMAGE_MODEL,
    'grok-imagine-image-quality',
    'grok-imagine-image',
  ])
  const normalizedPrompt = String(prompt || '').replace(/\s+/g, ' ').trim()
  const safePrompt = compactXaiImagePrompt(normalizedPrompt)

  if (safePrompt.length < normalizedPrompt.length) {
    console.info('xai image prompt compacted', {
      originalLength: normalizedPrompt.length,
      sentLength: safePrompt.length,
    })
  }

  let lastFailure: XaiImageGenerationResult = {
    ok: false,
    kind: 'provider',
    message: 'No image model returned an image',
  }

  for (const model of models) {
    try {
      const response = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: safePrompt,
          n: 1,
          response_format: 'url',
        }),
        signal: AbortSignal.timeout(90_000),
      })

      const raw = await response.text()
      let data: XaiImageResponse = {}
      try {
        data = raw ? (JSON.parse(raw) as XaiImageResponse) : {}
      } catch {
        console.error('xai image generation returned non-JSON', {
          model,
          status: response.status,
          body: raw.slice(0, 300),
        })
      }

      const url = extractXaiImageUrl(data)
      if (response.ok && url) {
        console.info('xai image generation succeeded', { model, status: response.status })
        return { ok: true, url, model }
      }

      const message = data.error?.message || data.message || raw.slice(0, 300) || 'Image generation failed'
      const kind = classifyXaiImageFailure(message, response.status)
      console.error('xai image generation failed', {
        model,
        status: response.status,
        kind,
        message: message.slice(0, 300),
      })
      lastFailure = { ok: false, kind, message, status: response.status, model }

      if (kind === 'blocked' || kind === 'configuration') return lastFailure
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('xai image generation request failed', { model, message })
      lastFailure = { ok: false, kind: 'network', message, model }
    }
  }

  return lastFailure
}
