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
          prompt,
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
