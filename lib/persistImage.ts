/**
 * Persist a remote generated image into Supabase Storage.
 *
 * Grok / xAI image URLs are temporary CDN links — gallery rows stay in the DB
 * but the pixels die. Upload to a public bucket so moments last.
 *
 * Uses the service-role client so uploads succeed even when the bucket policy
 * only allows service_role (anon key cannot write).
 *
 * Setup once in Supabase:
 *  1. Storage → New bucket → name: gallery  (Public: ON)
 *  2. Policies: public read + service_role write (already in place for you)
 *  3. Vercel env: SUPABASE_SERVICE_ROLE_KEY = <service_role secret>
 *
 * Returns the durable public URL, or the original url if upload fails.
 */

import { createServiceClient } from '@/utils/supabase/server'

const BUCKET = 'gallery'

export async function persistGeneratedImage(
  remoteUrl: string,
  opts: { characterName: string; kind?: string }
): Promise<string> {
  if (!remoteUrl) return remoteUrl

  try {
    const res = await fetch(remoteUrl)
    if (!res.ok) {
      console.error('persistGeneratedImage: failed to download remote image', res.status)
      return remoteUrl
    }

    const contentType = res.headers.get('content-type') || 'image/png'
    const ext =
      contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png'
    const buf = Buffer.from(await res.arrayBuffer())

    const safeName = (opts.characterName || 'companion')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 40)
    const kind = (opts.kind || 'scene').replace(/[^a-z0-9_]+/g, '')
    const path = `${safeName}/${kind}_${Date.now()}.${ext}`

    const supabase = createServiceClient()
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
      contentType,
      upsert: false,
    })

    if (error) {
      console.error('persistGeneratedImage upload failed', error.message)
      return remoteUrl
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl = data?.publicUrl

    if (!publicUrl) {
      console.error('persistGeneratedImage: getPublicUrl returned empty')
      return remoteUrl
    }

    console.log('persistGeneratedImage: stored', path)
    return publicUrl
  } catch (e) {
    console.error('persistGeneratedImage failed', e)
    return remoteUrl
  }
}
