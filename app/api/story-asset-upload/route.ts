import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'

const UPLOAD_KEY = 'ml-story-7e41c8b9f53a4d0aa52c30de9b4f8672'
const ALLOWED = new Set([
  '01-found-in-the-wilds.jpg',
  '02-growing-together.jpg',
  '03-academy-farewell.jpg',
  '04-separate-roads.jpg',
  '05-the-return.jpg',
  '06-beside-you.jpg',
  '07-first-quest.jpg',
])

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  if (request.headers.get('x-story-upload-key') !== UPLOAD_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  const name = String(form.get('name') || '')

  if (!(file instanceof File) || !ALLOWED.has(name)) {
    return NextResponse.json({ error: 'Invalid story asset' }, { status: 400 })
  }

  if (file.size > 5_000_000) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 })
  }

  const supabase = createServiceClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  const path = `story/${name}`

  const { error } = await supabase.storage.from('gallery').upload(path, bytes, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  })

  if (error) {
    console.error('story asset upload failed', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = supabase.storage.from('gallery').getPublicUrl(path)
  return NextResponse.json({ name, url: data.publicUrl })
}
