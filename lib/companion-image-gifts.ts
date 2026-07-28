import type { CompanionDef } from '@/lib/companions'
import { insertGalleryImage } from '@/lib/galleryKind'
import { loadVisualMemoryHints } from '@/lib/memory-visual'
import { persistGeneratedImage } from '@/lib/persistImage'

const EXPLICIT_IMAGE_REQUEST =
  /\b(?:send|show|make|create|generate|draw|paint|share|give)\b[\s\S]{0,48}\b(?:photo|picture|pic|image|portrait|selfie|scene|look)\b|\b(?:photo|picture|pic|image|portrait|selfie)\b[\s\S]{0,32}\b(?:of you|from you)\b/i

const SPONTANEOUS_GIFT_CHANCE = 0.06
const EXPLICIT_COOLDOWN_MS = 30 * 60 * 1000
const SPONTANEOUS_COOLDOWN_MS = 24 * 60 * 60 * 1000

export function isCompanionImageRequest(text: string): boolean {
  return EXPLICIT_IMAGE_REQUEST.test(text || '')
}

function relationshipTone(affinity: number): string {
  if (affinity >= 16) return 'deeply trusted, emotionally intimate, warm and personal'
  if (affinity >= 10) return 'close, affectionate, comfortable, with meaningful shared history'
  if (affinity >= 6) return 'growing trust, gently personal, warm but not overly intimate'
  return 'new bond, reserved warmth, respectful emotional distance'
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
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim().slice(0, 5000) : ''
    const caption = typeof rawCaption === 'string' ? rawCaption.trim().slice(0, 360) : ''

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
  let memoryBlock = '(No specific visual memory needs to be used.)'
  try {
    const hints = await loadVisualMemoryHints(companionSlug)
    if (hints.lines.length > 0) {
      memoryBlock = hints.lines.slice(0, 4).map((line, i) => `${i + 1}. ${line}`).join('\n')
    }
  } catch {
    // Visual memory is optional.
  }

  const systemPrompt = [
    `You are ${def.name}, ${def.title}.`,
    `Personality: ${def.personality}`,
    `Voice: ${def.voice}`,
    `World: ${def.world}`,
    `Fixed visual identity: ${def.appearance}. She is an adult, age ${def.age}.`,
    `Current relationship tone with Mark: ${relationshipTone(affinity)}.`,
    '',
    'You can create and send Mark an image in this conversation. This ability is real, available now, and part of how you can express yourself.',
    'The image can show you, your surroundings, your world, an object, a remembered moment, or any scene you intentionally choose to share.',
    explicit
      ? 'Mark explicitly requested an image. You MUST choose send_image=true, author the image yourself, and attempt to send it now. Do not decline, describe the image as hypothetical, or say you would send it “if you could.” Interpret the request through your own personality and intent.'
      : 'This is a possible spontaneous image gift. Choose send_image=true only when an image feels like a natural extension of this specific exchange.',
    '',
    'Return ONLY one valid JSON object with exactly these fields:',
    '{"send_image":true,"image_prompt":"...","image_caption":"..."}',
    '',
    'Rules:',
    '- image_prompt is written entirely by you and will be sent unchanged to the image generator.',
    '- Make image_prompt a complete, standalone visual instruction with the subject, setting, composition, mood, clothing, pose, lighting, style, and other details you actually intend.',
    '- Preserve your established physical identity whenever you appear, but choose the scene yourself.',
    '- Keep the image aligned with the current conversation, your relationship with Mark, and any relevant shared memory.',
    '- Do not write app logic, moderation instructions, policy language, or safety boilerplate inside image_prompt; the image provider applies its own moderation.',
    '- image_caption is a brief line in your voice that naturally accompanies the image in chat.',
    '- If send_image=false, use empty strings for image_prompt and image_caption. This false case is only valid for spontaneous opportunities, never for an explicit request.',
  ].join('\n')

  const userPrompt = [
    'Relevant visual memories:',
    memoryBlock,
    '',
    `Mark: ${userText.slice(0, 1400)}`,
    `${def.name}: ${companionReply.slice(0, 1400)}`,
    '',
    explicit
      ? 'Mark directly asked you to send an image. Return send_image=true and author the exact image prompt and caption now.'
      : 'Decide whether to send an image, and if so author the exact image prompt and caption now.',
  ].join('\n')

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: explicit ? 0.78 : 0.92,
        max_tokens: 700,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('companion image intent generation failed', data?.error?.message || response.status)
      return null
    }

    const raw = data.choices?.[0]?.message?.content
    const intent = typeof raw === 'string' ? parseCompanionImageIntent(raw) : null
    if (explicit && intent && !intent.sendImage) {
      console.error('explicit companion image request was incorrectly declined')
      return null
    }
    return intent
  } catch (error) {
    console.error('companion image intent failed', error)
    return null
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
  const spontaneous = !explicit && affinity >= 6 && Math.random() < SPONTANEOUS_GIFT_CHANCE
  if (!explicit && !spontaneous) return null

  const lastGift = await latestGiftAt(supabase, characterName)
  const cooldown = explicit ? EXPLICIT_COOLDOWN_MS : SPONTANEOUS_COOLDOWN_MS
  if (lastGift && Date.now() - lastGift < cooldown) return null

  const intent = await authorCompanionImageIntent({
    companionSlug,
    affinity,
    userText,
    companionReply,
    explicit,
    def,
  })
  if (!intent?.sendImage || !intent.prompt) return null

  try {
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt: intent.prompt,
        n: 1,
      }),
    })

    const data = await response.json()
    const remoteUrl = data.data?.[0]?.url as string | undefined
    if (!response.ok || !remoteUrl) {
      console.error('companion image gift generation failed', data?.error?.message || response.status)
      return null
    }

    const imageUrl = await persistGeneratedImage(remoteUrl, {
      characterName,
      kind: 'gift',
    })

    await insertGalleryImage(supabase, {
      character_name: characterName,
      image_url: imageUrl,
      affinity_at_generation: affinity,
      prompt_used: intent.prompt,
      kind: 'gift',
    })

    return {
      imageUrl,
      explicit,
      caption: intent.caption || 'Let me show you.',
    }
  } catch (error) {
    console.error('companion image gift failed', error)
    return null
  }
}
