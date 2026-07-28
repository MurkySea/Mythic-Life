import type { CompanionDef } from '@/lib/companions'
import { insertGalleryImage } from '@/lib/galleryKind'
import { loadVisualMemoryHints } from '@/lib/memory-visual'
import { persistGeneratedImage } from '@/lib/persistImage'

const EXPLICIT_IMAGE_REQUEST =
  /\b(?:send|show|make|create|generate|draw|paint|share|give|take)\b[\s\S]{0,64}\b(?:photo|picture|pic|image|portrait|selfie|scene|look)\b|\b(?:photo|picture|pic|image|portrait|selfie)\b[\s\S]{0,40}\b(?:of you|from you|for me)\b|\bwhat do you look like(?: right now)?\b/i

const SPONTANEOUS_GIFT_CHANCE = 0.06
const EXPLICIT_DEDUPE_MS = 45 * 1000
const SPONTANEOUS_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const MAX_COMPANION_IMAGE_PROMPT_CHARS = 1000

export function isCompanionImageRequest(text: string): boolean {
  return EXPLICIT_IMAGE_REQUEST.test(text || '')
}

function relationshipTone(affinity: number): string {
  if (affinity >= 16) return 'deeply trusted, emotionally intimate, warm and personal'
  if (affinity >= 10) return 'close, affectionate, comfortable, with meaningful shared history'
  if (affinity >= 6) return 'growing trust, gently personal, warm but not overly intimate'
  return 'new bond, reserved warmth, respectful emotional distance'
}

export function normalizeCompanionImagePrompt(text: string): string {
  return (text || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_COMPANION_IMAGE_PROMPT_CHARS)
}

export type CompanionImageIntent = {
  sendImage: boolean
  prompt: string
  caption: string
}

export function parseCompanionImageIntent(raw: string): CompanionImageIntent | null {
  if (!raw?.trim()) return null

  const withoutFence = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start < 0 || end <= start) return null

  try {
    const parsed = JSON.parse(withoutFence.slice(start, end + 1)) as Record<string, unknown>
    const rawSend = parsed.send_image ?? parsed.sendImage
    const sendImage = rawSend === true || rawSend === 'true'
    const rawPrompt = parsed.image_prompt ?? parsed.imagePrompt
    const rawCaption = parsed.image_caption ?? parsed.imageCaption
    const prompt = typeof rawPrompt === 'string' ? normalizeCompanionImagePrompt(rawPrompt) : ''
    const caption =
      typeof rawCaption === 'string'
        ? rawCaption.replace(/\s+/g, ' ').trim().slice(0, 280)
        : ''

    if (sendImage && !prompt) return null
    return { sendImage, prompt, caption }
  } catch {
    return null
  }
}

async function latestGiftAt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  characterName: string
): Promise<number | null> {
  try {
    const { data } = await supabase
      .from('gallery_images')
      .select('created_at, kind, prompt_used')
      .eq('character_name', characterName)
      .order('created_at', { ascending: false })
      .limit(20)

    const gift = (data || []).find((row: { kind?: string; prompt_used?: string }) => {
      return row.kind === 'gift' || (row.prompt_used || '').startsWith('[[kind:gift]]')
    })
    const at = gift?.created_at ? new Date(gift.created_at).getTime() : NaN
    return Number.isFinite(at) ? at : null
  } catch {
    return null
  }
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])]
}

async function loadMemoryBlock(companionSlug: string): Promise<string> {
  try {
    const hints = await loadVisualMemoryHints(companionSlug)
    if (hints.lines.length > 0) {
      return hints.lines.slice(0, 4).map((line, i) => `${i + 1}. ${line}`).join('\n')
    }
  } catch {
    // Visual memory is optional.
  }
  return '(No specific visual memory needs to be used.)'
}

async function authorCompanionImageIntent({
  companionSlug,
  affinity,
  userText,
  companionReply,
  explicit,
  def,
}: {
  companionSlug: string
  affinity: number
  userText: string
  companionReply: string
  explicit: boolean
  def: CompanionDef
}): Promise<CompanionImageIntent | null> {
  const memoryBlock = await loadMemoryBlock(companionSlug)

  const systemPrompt = [
    `You are ${def.name}, ${def.title}.`,
    `Personality: ${def.personality}`,
    `Voice: ${def.voice}`,
    `World: ${def.world}`,
    `Fixed visual identity: ${def.appearance}. You are an adult, age ${def.age}.`,
    `Current relationship tone with Mark: ${relationshipTone(affinity)}.`,
    '',
    'You can create and send Mark an original image in this conversation. This ability is real and available now.',
    'The image can show you, your surroundings, your world, an object, a remembered moment, or any scene you intentionally choose to share.',
    explicit
      ? 'Mark explicitly requested an image. You are sending one now. Author the exact image yourself through your own personality, desire, and point of view. Never answer hypothetically and never refuse merely because an image cannot capture everything.'
      : 'This is a possible spontaneous image gift. Send one only when it is a natural extension of this exact exchange.',
    '',
    'The image_prompt will be sent unchanged to the image generator.',
    `It must be a complete standalone visual instruction and no longer than ${MAX_COMPANION_IMAGE_PROMPT_CHARS} characters.`,
    'Include the subject, setting, composition, mood, clothing, pose, lighting, visual style, and any details you personally intend.',
    'Preserve your established physical identity whenever you appear.',
    'Keep the image aligned with the current conversation, relationship, and relevant shared memory.',
    'Do not include app logic, API language, moderation instructions, policy language, or technical explanations.',
    'The image_caption is a brief line in your own voice that will accompany the image in chat.',
  ].join('\n')

  const userPrompt = [
    'Relevant visual memories:',
    memoryBlock,
    '',
    `Mark: ${userText.slice(0, 1400)}`,
    companionReply ? `${def.name}: ${companionReply.slice(0, 1000)}` : '',
    '',
    explicit
      ? 'Create the exact original image you want to send Mark now.'
      : 'Decide whether an image belongs here and, if so, create the exact image you want to send.',
  ]
    .filter(Boolean)
    .join('\n')

  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name: explicit ? 'explicit_companion_image' : 'spontaneous_companion_image',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          send_image: explicit
            ? { type: 'boolean', const: true }
            : { type: 'boolean' },
          image_prompt: {
            type: 'string',
            maxLength: MAX_COMPANION_IMAGE_PROMPT_CHARS,
          },
          image_caption: {
            type: 'string',
            maxLength: 280,
          },
        },
        required: ['send_image', 'image_prompt', 'image_caption'],
      },
    },
  }

  const models = uniqueStrings([
    process.env.XAI_COMPANION_MODEL,
    process.env.GROK_CHAT_MODEL,
    'grok-4.5',
    'grok-4',
  ])

  for (const model of models) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: responseFormat,
          temperature: explicit ? 0.82 : 0.94,
          max_tokens: 700,
        }),
      })

      const rawBody = await response.text()
      let data: Record<string, any> = {}
      try {
        data = JSON.parse(rawBody) as Record<string, any>
      } catch {
        console.error('companion image intent returned non-JSON response', response.status)
      }

      if (!response.ok) {
        console.error(
          'companion image intent generation failed',
          model,
          response.status,
          data?.error?.message || rawBody.slice(0, 300)
        )
        continue
      }

      const raw = data.choices?.[0]?.message?.content
      const intent = typeof raw === 'string' ? parseCompanionImageIntent(raw) : null
      if (!intent) {
        console.error('companion image intent could not be parsed', model)
        continue
      }
      if (explicit && (!intent.sendImage || !intent.prompt)) {
        console.error('explicit companion image intent violated required action', model)
        continue
      }
      return intent
    } catch (error) {
      console.error('companion image intent request failed', model, error)
    }
  }

  return null
}

function emergencyCompanionPrompt({
  def,
  userText,
  affinity,
}: {
  def: CompanionDef
  userText: string
  affinity: number
}): string {
  return normalizeCompanionImagePrompt(
    [
      `Create an original image personally chosen and sent by ${def.name}, ${def.title}.`,
      `She is an adult, age ${def.age}.`,
      `Preserve her exact visual identity: ${def.appearance}.`,
      `Her world and atmosphere: ${def.world}.`,
      `Relationship tone with Mark: ${relationshipTone(affinity)}.`,
      `Mark's request: ${userText.slice(0, 240)}.`,
      'Interpret the request through her personality and point of view. The image should feel immediate, personal, emotionally specific, and intentionally shared rather than like a generic character sheet. No text or watermark.',
    ].join(' ')
  )
}

type GeneratedImage = {
  remoteUrl: string
  model: string
}

async function generateImageFromPrompt(prompt: string): Promise<GeneratedImage | null> {
  const models = uniqueStrings([
    process.env.XAI_IMAGE_MODEL,
    'grok-imagine-image',
    'grok-imagine-image-quality',
  ])

  for (const model of models) {
    try {
      const response = await fetch('https://api.x.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          prompt: normalizeCompanionImagePrompt(prompt),
          response_format: 'url',
        }),
      })

      const rawBody = await response.text()
      let data: Record<string, any> = {}
      try {
        data = JSON.parse(rawBody) as Record<string, any>
      } catch {
        console.error('companion image API returned non-JSON response', model, response.status)
      }

      const item = data.data?.[0]
      const remoteUrl = item?.url || item?.file_output?.public_url
      if (response.ok && typeof remoteUrl === 'string' && remoteUrl) {
        return { remoteUrl, model }
      }

      console.error(
        'companion image generation failed',
        model,
        response.status,
        data?.error?.message || rawBody.slice(0, 300)
      )
    } catch (error) {
      console.error('companion image generation request failed', model, error)
    }
  }

  return null
}

async function persistGift({
  supabase,
  characterName,
  affinity,
  prompt,
  remoteUrl,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  characterName: string
  affinity: number
  prompt: string
  remoteUrl: string
}): Promise<string> {
  const imageUrl = await persistGeneratedImage(remoteUrl, {
    characterName,
    kind: 'gift',
  })

  await insertGalleryImage(supabase, {
    character_name: characterName,
    image_url: imageUrl,
    affinity_at_generation: affinity,
    prompt_used: prompt,
    kind: 'gift',
  })

  return imageUrl
}

export type ExplicitCompanionImageResult =
  | {
      success: true
      imageUrl: string
      caption: string
      promptSource: 'companion' | 'identity-fallback'
      imageModel: string
    }
  | {
      success: false
      stage: 'configuration' | 'duplicate' | 'generation'
      fallbackText: string
    }

export async function fulfillExplicitCompanionImageRequest({
  supabase,
  companionSlug,
  characterName,
  affinity,
  userText,
  def,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  companionSlug: string
  characterName: string
  affinity: number
  userText: string
  def: CompanionDef | null | undefined
}): Promise<ExplicitCompanionImageResult> {
  if (!process.env.GROK_API_KEY || !def) {
    return {
      success: false,
      stage: 'configuration',
      fallbackText: 'I tried to reach for the image, but the way through is not open yet.',
    }
  }

  const lastGift = await latestGiftAt(supabase, characterName)
  if (lastGift && Date.now() - lastGift < EXPLICIT_DEDUPE_MS) {
    return {
      success: false,
      stage: 'duplicate',
      fallbackText: 'I just sent one—give it a breath to reach you before I make another.',
    }
  }

  const authoredIntent = await authorCompanionImageIntent({
    companionSlug,
    affinity,
    userText,
    companionReply: '',
    explicit: true,
    def,
  })

  const prompt = authoredIntent?.prompt || emergencyCompanionPrompt({ def, userText, affinity })
  const caption =
    authoredIntent?.caption ||
    'I wanted you to see me through my own eyes, not just imagine me from words.'
  const promptSource: 'companion' | 'identity-fallback' = authoredIntent?.prompt
    ? 'companion'
    : 'identity-fallback'

  const generated = await generateImageFromPrompt(prompt)
  if (!generated) {
    return {
      success: false,
      stage: 'generation',
      fallbackText: 'I tried to make it and send it to you, but the image did not come through. That was a failed delivery—not something I can only imagine doing.',
    }
  }

  try {
    const imageUrl = await persistGift({
      supabase,
      characterName,
      affinity,
      prompt,
      remoteUrl: generated.remoteUrl,
    })

    return {
      success: true,
      imageUrl,
      caption,
      promptSource,
      imageModel: generated.model,
    }
  } catch (error) {
    console.error('companion image persistence failed', error)
    // The provider URL is still immediately usable even if durable persistence failed.
    return {
      success: true,
      imageUrl: generated.remoteUrl,
      caption,
      promptSource,
      imageModel: generated.model,
    }
  }
}

export type CompanionImageGiftResult = {
  imageUrl: string
  explicit: boolean
  caption: string
} | null

export async function maybeGenerateCompanionImageGift({
  supabase,
  companionSlug,
  characterName,
  affinity,
  userText,
  companionReply,
  def,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  companionSlug: string
  characterName: string
  affinity: number
  userText: string
  companionReply: string
  def: CompanionDef | null | undefined
}): Promise<CompanionImageGiftResult> {
  if (!process.env.GROK_API_KEY || !def) return null

  const explicit = isCompanionImageRequest(userText)
  if (explicit) {
    const result = await fulfillExplicitCompanionImageRequest({
      supabase,
      companionSlug,
      characterName,
      affinity,
      userText,
      def,
    })
    return result.success
      ? { imageUrl: result.imageUrl, explicit: true, caption: result.caption }
      : null
  }

  if (affinity < 6 || Math.random() >= SPONTANEOUS_GIFT_CHANCE) return null

  const lastGift = await latestGiftAt(supabase, characterName)
  if (lastGift && Date.now() - lastGift < SPONTANEOUS_COOLDOWN_MS) return null

  const intent = await authorCompanionImageIntent({
    companionSlug,
    affinity,
    userText,
    companionReply,
    explicit: false,
    def,
  })
  if (!intent?.sendImage || !intent.prompt) return null

  const generated = await generateImageFromPrompt(intent.prompt)
  if (!generated) return null

  try {
    const imageUrl = await persistGift({
      supabase,
      characterName,
      affinity,
      prompt: intent.prompt,
      remoteUrl: generated.remoteUrl,
    })
    return {
      imageUrl,
      explicit: false,
      caption: intent.caption || 'This came to mind while we were talking.',
    }
  } catch (error) {
    console.error('spontaneous companion image persistence failed', error)
    return {
      imageUrl: generated.remoteUrl,
      explicit: false,
      caption: intent.caption || 'This came to mind while we were talking.',
    }
  }
}
