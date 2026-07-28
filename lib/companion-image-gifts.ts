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

function cleanConcept(text: string): string {
  return (text || '')
    .replace(EXPLICIT_IMAGE_REQUEST, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
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

  let memoryFlavor = ''
  try {
    const hints = await loadVisualMemoryHints(companionSlug)
    if (hints.lines.length > 0) {
      memoryFlavor = ` Subtle shared-history details: ${hints.lines.slice(0, 3).join('; ')}.`
    }
  } catch {
    // Memory flavor is optional.
  }

  const requestedConcept = cleanConcept(userText)
  const concept = explicit && requestedConcept
    ? `The user requested this idea: ${requestedConcept}. Interpret it naturally while keeping the companion visually consistent.`
    : `She chose to share a quiet visual moment inspired by the current conversation and her reply: ${companionReply.slice(0, 320)}.`

  const prompt = [
    `Create a cinematic dark-fantasy image shared personally by ${def.name}, ${def.title}.`,
    `Character consistency: ${def.appearance}.`,
    `Her world and atmosphere: ${def.world}.`,
    `Relationship tone: ${relationshipTone(affinity)}.`,
    concept,
    memoryFlavor,
    'The image should feel like a moment she intentionally chose to send, not a generic character sheet.',
    'Single adult woman, tasteful and non-explicit, emotionally expressive, premium fantasy illustration, cinematic lighting, detailed environment, no text, no captions, no logos, no watermark.',
  ]
    .filter(Boolean)
    .join(' ')

  try {
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt,
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
      prompt_used: prompt,
      kind: 'gift',
    })

    return {
      imageUrl,
      explicit,
      caption: explicit
        ? 'I made this for you.'
        : 'This came to mind while we were talking. I wanted you to see it.',
    }
  } catch (error) {
    console.error('companion image gift failed', error)
    return null
  }
}
