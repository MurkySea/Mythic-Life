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
  if (/no animal|ears?|tail|wings?|horns?|scales?/.test(s)) return 6
  if (/hair|eyes?|piercing|beauty mark|freckle/.test(s)) return 5
  if (/dress|outfit|clothing|robe|armor|figure|curves?|waist/.test(s)) return 4
  if (/skin|markings?|adult|age|race|fae|angel|celestial|foxkin/.test(s)) return 3
  return 1
}

/**
 * Scene prompts contain a detailed character block plus composition fields.
 * If the combined prompt grows beyond xAI's limit, keep the strongest visual
 * identity details and the actual scene directions rather than blindly slicing
 * off the end (which used to discard pose/setting/lighting).
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

  const sceneFields = segments.filter((segment) =>
    /^(Name context|Expression|Outfit|Pose|Setting|Camera|Lighting|Species \/ world detail|Secondary atmosphere):/i.test(
      segment
    )
  )
  const closing = segments.filter(
    (segment) =>
      /single character focus|no text|no watermark|romantic intimacy|emotional closeness|not romantic|sensual tension/i.test(
        segment
      ) && !sceneFields.includes(segment)
  )

  const characterLead = character.slice(0, 1)
  const characterDetails = character
    .slice(1)
    .map((segment, index) => ({ segment, index, priority: visualPriority(segment) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)

  const chosen: string[] = []
  const seen = new Set<string>()
  const add = (segment: string) => {
    const clean = segment.replace(/[.\s]+$/g, '').trim()
    if (!clean || seen.has(clean)) return
    const candidate = [...chosen, clean].join('. ') + '.'
    if (candidate.length <= XAI_IMAGE_PROMPT_LIMIT) {
      chosen.push(clean)
      seen.add(clean)
    }
  }

  // Keep quality/style, then the character's identity anchor.
  for (const segment of opening.slice(0, 2)) add(segment)
  for (const segment of characterLead) add(segment)

  // Reserve scene semantics early so a detailed character never crowds them out.
  for (const segment of sceneFields) add(segment)
  for (const segment of closing) add(segment)

  // Spend the remaining budget on the most identity-critical appearance details.
  for (const { segment } of characterDetails) add(segment)

  let compacted = chosen.join('. ')
  if (compacted && !compacted.endsWith('.')) compacted += '.'

  // Absolute guardrail for unusual unstructured prompts.
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
  const safePrompt = compactXaiImagePrompt(prompt)

  if (safePrompt.length < String(prompt || '').replace(/\s+/g, ' ').trim().length) {
    console.info('xai image prompt compacted', {
      originalLength: String(prompt || '').replace(/\s+/g, ' ').trim().length,
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
