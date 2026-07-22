import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string }>
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="max-w-md mx-auto p-6 pb-24">
        <h1 className="text-xl text-white pt-8">Gallery</h1>
        <p className="text-zinc-500 text-sm mt-2">Supabase env vars missing on this deployment.</p>
      </main>
    )
  }

  const params = await searchParams
  const supabase = await createClient()

  const { data: allImages } = await supabase
    .from('gallery_images')
    .select('character_name')
    .order('created_at', { ascending: false })

  const characters = Array.from(
    new Set((allImages || []).map((img) => img.character_name))
  )

  const activeCharacter = params.character || characters[0] || 'Seraphine'

  const { data: images } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('character_name', activeCharacter)
    .order('created_at', { ascending: false })

  function getIntimacyLabel(affinity: number | null): string {
    if (!affinity) return ''
    if (affinity >= 10) return 'Deeply Intimate'
    if (affinity >= 7) return 'Close & Tender'
    if (affinity >= 4) return 'Warming Bond'
    return 'Quiet Companion'
  }

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
      <div className="pt-4">
        <p className="text-zinc-500 text-sm">Collected moments</p>
        <h1 className="text-2xl font-medium text-white">Gallery</h1>
      </div>

      {characters.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {characters.map((name) => (
            <Link
              key={name}
              href={`/gallery?character=${encodeURIComponent(name)}`}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition ${
                activeCharacter === name
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {name}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-zinc-500 text-sm">
          No scenes yet. Generate one from a companion profile.
        </div>
      )}

      {images && images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img: { id: string; image_url: string; character_name: string; affinity_at_generation?: number; created_at: string }) => (
            <div
              key={img.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image_url}
                alt={`${img.character_name} scene`}
                className="w-full aspect-[3/4] object-cover"
              />
              <div className="p-2.5">
                {img.affinity_at_generation != null && (
                  <p className="text-[10px] text-violet-400/80 uppercase tracking-wider">
                    {getIntimacyLabel(img.affinity_at_generation)}
                  </p>
                )}
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {new Date(img.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : characters.length > 0 ? (
        <div className="text-center py-16 text-zinc-500 text-sm">
          No scenes for {activeCharacter} yet.
        </div>
      ) : null}
    </main>
  )
}
