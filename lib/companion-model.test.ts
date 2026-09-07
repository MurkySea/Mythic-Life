import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractOpenAIText,
  generateCompanionDraft,
} from '@/lib/companion-model'

describe('companion model provider', () => {
  const originalOpenAI = process.env.OPENAI_API_KEY
  const originalGrok = process.env.GROK_API_KEY
  const originalOpenAIModel = process.env.OPENAI_COMPANION_MODEL
  const originalXaiModel = process.env.XAI_COMPANION_MODEL

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalOpenAI == null) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalOpenAI
    if (originalGrok == null) delete process.env.GROK_API_KEY
    else process.env.GROK_API_KEY = originalGrok
    if (originalOpenAIModel == null) delete process.env.OPENAI_COMPANION_MODEL
    else process.env.OPENAI_COMPANION_MODEL = originalOpenAIModel
    if (originalXaiModel == null) delete process.env.XAI_COMPANION_MODEL
    else process.env.XAI_COMPANION_MODEL = originalXaiModel
  })

  it('extracts Responses API output text safely', () => {
    expect(extractOpenAIText({ output_text: '  hello there  ' })).toBe('hello there')
    expect(
      extractOpenAIText({
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'fallback shape' }],
          },
        ],
      })
    ).toBe('fallback shape')
  })

  it('prefers OpenAI when the key is configured', async () => {
    process.env.OPENAI_API_KEY = 'openai-test'
    process.env.GROK_API_KEY = 'grok-test'

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ output_text: 'Sol reply' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await generateCompanionDraft({
      system: 'system',
      user: 'user',
      maxVisibleTokens: 180,
    })

    expect(result).toMatchObject({
      text: 'Sol reply',
      provider: 'openai',
      model: 'gpt-5.6-sol',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.openai.com/v1/responses')
  })

  it('falls back to xAI when the OpenAI request fails', async () => {
    process.env.OPENAI_API_KEY = 'openai-test'
    process.env.GROK_API_KEY = 'grok-test'

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('temporary error', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'Grok fallback' } }] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )

    const result = await generateCompanionDraft({
      system: 'system',
      user: 'user',
      maxVisibleTokens: 180,
    })

    expect(result).toMatchObject({ text: 'Grok fallback', provider: 'xai' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('api.x.ai/v1/chat/completions')
  })
})
