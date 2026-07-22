import type { CompanionDef } from './companions'
import { createClient } from '@/utils/supabase/server'

const BASE_TAG = '[BASE]'
const CHIBI_TAG = '[CHIBI]'

function look(def: CompanionDef): string {
  return (
    def.appearance?.trim() ||
    `adult ${def.race} woman named ${def.name}, feminine features matching canon`
  )
}

/** Simple clean headshot — default unlock portrait */
export function buildBaseHeadshotPrompt(def: CompanionDef): string {
  return [
    'masterpiece anime portrait, adult woman, clean simple headshot',
    'shoulders-up, centered face, soft studio lighting, neutral soft background',
    'modest everyday clothes, calm neutral-to-gentle expression, high quality',
    look(def),
    def.name,
  ].join(', ')
}

/** Cute chibi face icon for message list / party strip */
export function buildChibiIconPrompt(def: CompanionDef): string {
  return [
    'cute chibi anime icon, adult woman character, circular crop friendly',
    'big expressive eyes, simple soft shading, transparent-feel plain background',
    'head and shoulders chibi, friendly, clean lines, sticker style, high quality',
    look(def),
    def.name,
  ].join(', ')
}

async function callImagine(prompt: string): Promise<string | null> {
  if (!process.env.GROK_API_KEY) return null
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
    return (data.data?.[0]?.url as string) || null
  } catch (e) {
    console.error('imagine failed', e)
    return null
  }
}

/**
 * Generate base headshot (+ optional chibi) for a companion.
 * Base → companion.image_url + gallery [BASE]
 * Chibi → gallery [CHIBI] (used as message icons)
 */
export async function ensureCompanionAvatars(
  def: CompanionDef,
  options: { force?: boolean; chibi?: boolean } = {}
): Promise<{ headshot?: string; chibi?: string }> {
  const { force = false, chibi = true } = options
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('companion')
    .select('id, image_url, name')
    .or(`slug.eq.${def.slug},name.eq.${def.name}`)
    .maybeSingle()

  if (!row) return {}

  const result: { headshot?: string; chibi?: string } = {}

  // Headshot
  if (force || !row.image_url) {
    const prompt = `${BASE_TAG} ${buildBaseHeadshotPrompt(def)}`
    const url = await callImagine(prompt)
    if (url) {
      await supabase.from('companion').update({ image_url: url }).eq('id', row.id)
      await supabase.from('gallery_images').insert({
        character_name: row.name || def.name,
        image_url: url,
        affinity_at_generation: 1,
        prompt_used: prompt,
      })
      result.headshot = url
    }
  } else {
    result.headshot = row.image_url
  }

  // Chibi icon
  if (chibi) {
    const { data: existingChibi } = await supabase
      .from('gallery_images')
      .select('image_url')
      .eq('character_name', row.name || def.name)
      .ilike('prompt_used', `${CHIBI_TAG}%`)
      .limit(1)
      .maybeSingle()

    if (force || !existingChibi?.image_url) {
      const prompt = `${CHIBI_TAG} ${buildChibiIconPrompt(def)}`
      const url = await callImagine(prompt)
      if (url) {
        await supabase.from('gallery_images').insert({
          character_name: row.name || def.name,
          image_url: url,
          affinity_at_generation: 0,
          prompt_used: prompt,
        })
        result.chibi = url
      }
    } else {
      result.chibi = existingChibi.image_url
    }
  }

  return result
}

/** Map character_name → chibi URL for inbox icons */
export async function loadChibiMap(
  names: string[]
): Promise<Record<string, string>> {
  if (names.length === 0) return {}
  const supabase = await createClient()
  const { data } = await supabase
    .from('gallery_images')
    .select('character_name, image_url, prompt_used, created_at')
    .in('character_name', names)
    .ilike('prompt_used', `${CHIBI_TAG}%`)
    .order('created_at', { ascending: false })

  const map: Record<string, string> = {}
  for (const row of data || []) {
    if (row.character_name && row.image_url && !map[row.character_name]) {
      map[row.character_name] = row.image_url
    }
  }
  return map
}
