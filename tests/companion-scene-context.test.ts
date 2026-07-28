import { describe, expect, it } from 'vitest'
import {
  buildSceneAwareImageRequest,
  cleanSceneMessage,
} from '@/lib/companion-scene-context'

describe('companion image scene context', () => {
  it('keeps the recent roleplay scene in chronological order and omits the duplicate trigger', () => {
    const result = buildSceneAwareImageRequest({
      currentRequest: 'Show me this moment.',
      companionName: 'Vesper',
      recentMessagesNewestFirst: [
        { role: 'user', content: 'Show me this moment.' },
        { role: 'companion', content: 'I lean against the rain-dark balcony rail beside you.' },
        { role: 'user', content: 'I step out onto the balcony and take your hand.' },
      ],
    })

    expect(result).toContain('Mark: I step out onto the balcony and take your hand.')
    expect(result).toContain('Vesper: I lean against the rain-dark balcony rail beside you.')
    expect(result.indexOf('Mark: I step out')).toBeLessThan(result.indexOf('Vesper: I lean'))
    expect(result.match(/Show me this moment\./g)).toHaveLength(1)
    expect(result).toContain('Preserve the latest established location')
  })

  it('removes raw generated-image URLs from prior turns', () => {
    expect(cleanSceneMessage('Here.\n[image:https://temporary.example/image.png]')).toBe(
      'Here. [image previously shared]'
    )
  })

  it('bounds large transcripts while preserving the current request', () => {
    const result = buildSceneAwareImageRequest({
      currentRequest: 'Send me a picture of what is happening right now.',
      companionName: 'Iris',
      recentMessagesNewestFirst: Array.from({ length: 30 }, (_, index) => ({
        role: index % 2 === 0 ? 'companion' : 'user',
        content: `Turn ${index} ${'detail '.repeat(80)}`,
      })),
    })

    expect(result.length).toBeLessThanOrEqual(1350)
    expect(result).toContain('CURRENT IMAGE REQUEST: Send me a picture of what is happening right now.')
  })
})
