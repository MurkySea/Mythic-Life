import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Get all unique characters that have images
  const { data: allImages } = await supabase
    .from('gallery_images')
    .select('character_name')
    .order('created_at', { ascending: false })

  const characters = Array.from(
    new Set((allImages || []).map((img) => img.character_name))
  )

  // Default to Seraphine or the first available character
  const activeCharacter = params.character || characters[0] || 'Seraphine'

  // Get images for the active character
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
      {/* Header */}
      <div className="pt-4">
        <p className="text-zinc-500 text-sm">Collected moments</p>
        <h1 className="text-2xl font-medium text-white">Gallery</h1>
      </div>

      {/* Character Tabs */}
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
          No scenes yet. Generate one from the Companion page.
        </div>
      )}

      {/* Image Grid */}
      {images && images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img: any) => (
            <div
              key={img.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              <img
                src={img.image_url}
                alt={`${img.character_name} scene`}
                className="w-full aspect-[3/4] object-cover"
              />
              <div className="p-2.5">
                {img.affinity_at_generation && (
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
