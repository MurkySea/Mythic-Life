import { describe, expect, it } from 'vitest'
import { isCompanionImageRequest } from '@/lib/companion-image-gifts'

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
