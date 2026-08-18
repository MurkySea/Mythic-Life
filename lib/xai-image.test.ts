import { describe, expect, it } from 'vitest'
import { classifyXaiImageFailure, extractXaiImageUrl } from './xai-image'

describe('xAI image response handling', () => {
  it('prefers a stable file public URL when the provider returns one', () => {
    expect(
      extractXaiImageUrl({
        data: [
          {
            url: 'https://temporary.example/image.jpg',
            file_output: { public_url: 'https://stable.example/image.jpg' },
          },
        ],
      })
    ).toBe('https://stable.example/image.jpg')
  })

  it('falls back to the ordinary generation URL', () => {
    expect(
      extractXaiImageUrl({ data: [{ url: 'https://temporary.example/image.jpg' }] })
    ).toBe('https://temporary.example/image.jpg')
  })

  it('distinguishes moderation blocks from generic provider errors', () => {
    expect(classifyXaiImageFailure('Request blocked by safety policy', 400)).toBe('blocked')
    expect(classifyXaiImageFailure('Invalid parameter: response_format', 400)).toBe('provider')
  })

  it('treats provider authentication failures as configuration problems', () => {
    expect(classifyXaiImageFailure('Unauthorized', 401)).toBe('configuration')
    expect(classifyXaiImageFailure('Forbidden', 403)).toBe('configuration')
  })
})
