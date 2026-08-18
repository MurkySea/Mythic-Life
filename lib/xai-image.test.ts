import { describe, expect, it } from 'vitest'
import {
  classifyXaiImageFailure,
  compactXaiImagePrompt,
  extractXaiImageUrl,
  XAI_IMAGE_PROMPT_LIMIT,
} from './xai-image'

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

  it('compacts oversized character scenes without losing identity or scene anchors', () => {
    const oversized = [
      'masterpiece illustration of an adult woman, coherent anatomy, beautiful lighting, high detail, no text, no watermark',
      'semi-realistic anime, detailed skin and fabric',
      'Character: Beautiful adult woman, age 22',
      'Long wavy platinum-silver blonde hair with soft blunt bangs',
      'Striking bright blue eyes',
      'Fair porcelain skin with only a light scattering of freckles across the nose and cheeks',
      'Septum piercing and a small left nostril piercing',
      'Tiny beauty mark near the corner of full lips',
      'Subtle elegant pointed ears; no animal ears and no tail',
      'Soft voluptuous hourglass figure with natural curves and a narrow waist',
      'Everyday signature look: pale cream cotton floral sundress with tiny pink, yellow, and white wildflowers, spaghetti straps, fitted bodice, flowing skirt',
      'Power state: enormous spectral angelic wings of golden-white living light with translucent iridescent fae structure beneath the feather-like forms',
      'Overall visual principle: beautiful woman first, fantasy second, unmistakably otherworldly details revealed by ears, eyes, magic, and wings',
      `Long expendable lore detail ${'x'.repeat(900)}`,
      'Name context: Elowen',
      'Expression: gentle genuine smile',
      'Personality read: soft protective warmth in the eyes',
      'Outfit: light flowing dress',
      'Pose: standing with weight on one hip',
      'Setting: golden-hour window',
      'Camera: medium shot, eye level',
      'Lighting: warm golden key light',
      'Composition: soft bokeh background',
      'Species / world detail: luminous living-light motes around her',
      'Secondary atmosphere: flowers subtly responding to her magic',
      'emotional closeness, soft chemistry',
      'single character focus, clear face, feminine adult proportions',
    ].join('. ')

    const compacted = compactXaiImagePrompt(oversized)

    expect(compacted.length).toBeLessThanOrEqual(XAI_IMAGE_PROMPT_LIMIT)
    expect(compacted).toContain('platinum-silver blonde hair')
    expect(compacted).toContain('bright blue eyes')
    expect(compacted).toContain('Septum piercing')
    expect(compacted).toContain('pointed ears')
    expect(compacted).toContain('wings')
    expect(compacted).toContain('Pose:')
    expect(compacted).toContain('Setting:')
    expect(compacted).toContain('Lighting:')
  })
})
