import { describe, expect, it } from 'vitest'
import {
  isCompanionImageRequest,
  MAX_COMPANION_IMAGE_PROMPT_CHARS,
  normalizeCompanionImagePrompt,
  parseCompanionImageIntent,
} from '@/lib/companion-image-gifts'

describe('companion image request intent', () => {
  it.each([
    'Send me a picture of you',
    'Can you send me a picture of you by the fire?',
    'Show me a portrait of you in your world.',
    'Make an image from that scene.',
    'Could I get a selfie from you?',
    'Generate a photo of what you are seeing.',
    'Take a picture for me.',
    'What do you look like right now?',
  ])('detects an explicit request: %s', (text) => {
    expect(isCompanionImageRequest(text)).toBe(true)
  })

  it.each([
    'How was your day?',
    'Tell me what the silver wood is like.',
    'I miss you.',
    'That gives me a vivid picture in my head.',
    'You look happy today.',
  ])('does not treat normal conversation as a request: %s', (text) => {
    expect(isCompanionImageRequest(text)).toBe(false)
  })
})

describe('companion-authored image intent payload', () => {
  it('parses a fenced JSON image decision', () => {
    const result = parseCompanionImageIntent(`
      \`\`\`json
      {
        "send_image": true,
        "image_prompt": "Seraphine seated beside a silver-wood fire, looking toward Mark through warm amber light.",
        "image_caption": "This is what I meant when I said I stayed."
      }
      \`\`\`
    `)

    expect(result).toEqual({
      sendImage: true,
      prompt: 'Seraphine seated beside a silver-wood fire, looking toward Mark through warm amber light.',
      caption: 'This is what I meant when I said I stayed.',
    })
  })

  it('allows the companion to decline a spontaneous opportunity without inventing a prompt', () => {
    expect(
      parseCompanionImageIntent(
        '{"send_image":false,"image_prompt":"","image_caption":""}'
      )
    ).toEqual({ sendImage: false, prompt: '', caption: '' })
  })

  it('rejects send decisions that omit the authored prompt', () => {
    expect(
      parseCompanionImageIntent(
        '{"send_image":true,"image_prompt":"","image_caption":"I tried."}'
      )
    ).toBeNull()
  })

  it('rejects malformed model output', () => {
    expect(parseCompanionImageIntent('I think I would send one.')).toBeNull()
  })

  it('clamps authored prompts to the image API limit', () => {
    const prompt = normalizeCompanionImagePrompt(`  ${'x'.repeat(1500)}  `)
    expect(prompt).toHaveLength(MAX_COMPANION_IMAGE_PROMPT_CHARS)
  })

  it('clamps prompts while parsing structured intent', () => {
    const longPrompt = 'x'.repeat(1500)
    const result = parseCompanionImageIntent(
      JSON.stringify({
        send_image: true,
        image_prompt: longPrompt,
        image_caption: 'Here.',
      })
    )

    expect(result?.prompt).toHaveLength(MAX_COMPANION_IMAGE_PROMPT_CHARS)
  })
})
