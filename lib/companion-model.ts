export type CompanionDraftRequest = {
  system: string
  user: string
  maxVisibleTokens: number
  attempt?: number
  temperature?: number
}

export type CompanionDraftResult = {
  text: string
  provider: 'openai' | 'xai'
  model: string
}

type OpenAIResponse = {
  output_text?: string | null
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string | null
    }>
  }>
}

type XaiResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

export function extractOpenAIText(data: OpenAIResponse): string {
  const direct = String(data.output_text || '').trim()
  if (direct) return direct

  return (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text')
    .map((part) => String(part.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

async function requestOpenAI(opts: CompanionDraftRequest): Promise<CompanionDraftResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')

  const model = process.env.OPENAI_COMPANION_MODEL || 'gpt-5.6-sol'
  // Reasoning tokens count against the output budget. Give Sol enough room to
  // think without encouraging a long visible reply; the companion prompt still
  // controls visible length and the quality loop enforces the conversation shape.
  const maxOutputTokens = Math.max(768, Math.min(2400, opts.maxVisibleTokens * 4))

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: opts.system,
      input: opts.user,
      store: false,
      reasoning: {
        effort: (opts.attempt || 1) > 1 ? 'medium' : 'low',
      },
      text: {
        verbosity: 'low',
      },
      max_output_tokens: maxOutputTokens,
    }),
    signal: AbortSignal.timeout(35_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`OpenAI API returned ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`)
  }

  const data = (await response.json()) as OpenAIResponse
  const text = extractOpenAIText(data)
  if (!text) throw new Error('OpenAI API returned no companion text')

  return { text, provider: 'openai', model }
}

async function requestXai(opts: CompanionDraftRequest): Promise<CompanionDraftResult> {
  const apiKey = process.env.GROK_API_KEY
  if (!apiKey) throw new Error('GROK_API_KEY is not configured')

  const model =
    process.env.XAI_COMPANION_MODEL ||
    process.env.GROK_CHAT_MODEL ||
    'grok-4'

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: opts.temperature ?? 0.9,
      max_tokens: opts.maxVisibleTokens,
    }),
    signal: AbortSignal.timeout(35_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`xAI API returned ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`)
  }

  const data = (await response.json()) as XaiResponse
  const text = String(data.choices?.[0]?.message?.content || '').trim()
  if (!text) throw new Error('xAI API returned no companion text')

  return { text, provider: 'xai', model }
}

/**
 * Conversation generation is OpenAI-first when an OpenAI key exists, with xAI
 * retained as a provider-level fallback. This keeps provider outages or account
 * limits from turning the companion into a canned fallback message.
 */
export async function generateCompanionDraft(
  opts: CompanionDraftRequest
): Promise<CompanionDraftResult> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await requestOpenAI(opts)
    } catch (error) {
      console.warn('OpenAI companion generation failed; falling back to xAI', error)
      if (!process.env.GROK_API_KEY) throw error
    }
  }

  return requestXai(opts)
}
