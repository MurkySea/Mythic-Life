import { describe, expect, it } from 'vitest'
import {
  isCompanionImageRequest,
  parseCompanionImageIntent,
} from '@/lib/companion-image-gifts'

describe('companion image request intent', () => {
  it.each([
    'Can you send me a picture of you by the fire?',
    'Show me a portrait of you in your world.',
    'Make an image from that scene.',
    'Could I get a selfie from you?',
    'Generate a photo of what you are seeing.',
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

  it('allows the companion to decline without inventing a prompt', () => {
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
})
