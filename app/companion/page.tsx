import { createClient } from '@/utils/supabase/server'
import { getScenePrompt } from '../actions'
import { revalidatePath } from 'next/cache'

async function generateCompanionImage() {
  'use server'

  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('affinity_score, name')
    .single()

  const affinity = companion?.affinity_score || 1
  const characterName = companion?.name || 'Seraphine'
  const prompt = await getScenePrompt(affinity)

  try {
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt: prompt,
        n: 1,
      }),
    })

    const data = await response.json()
    const imageUrl = data.data?.[0]?.url

    if (imageUrl) {
      // Update the main portrait
      await supabase
        .from('companion')
        .update({ image_url: imageUrl })
        .eq('name', characterName)

      // Also save to the gallery for history
      await supabase.from('gallery_images').insert({
        character_name: characterName,
        image_url: imageUrl,
        affinity_at_generation: affinity,
        prompt_used: prompt,
      })
    }

    console.log("Grok Imagine response:", data)
  } catch (error) {
    console.error("Image generation error:", error)
  }

  revalidatePath('/companion')
  revalidatePath('/companion-profile')
  revalidatePath('/gallery')
}

function getIntimacyLabel(affinity: number): string {
  if (affinity >= 10) return 'Deeply Intimate'
  if (affinity >= 7) return 'Close & Tender'
  if (affinity >= 4) return 'Warming Bond'
  return 'Quiet Companion'
}

export default async function CompanionPage() {
  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('*')
    .single()

  const affinity = companion?.affinity_score || 1
  const intimacyLabel = getIntimacyLabel(affinity)

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
      {/* Header with back button */}
      <div className="pt-4 flex items-center gap-3">
        <a 
          href="/" 
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition"
        >
          ←
        </a>
        <div>
          <p className="text-zinc-500 text-sm">Your companion</p>
          <h1 className="text-2xl font-medium text-white">
            {companion ? companion.name : 'Companion'}
          </h1>
        </div>
      </div>

      {companion && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          {/* Avatar + Generate Button */}
          <div className="flex flex-col items-center gap-3">
            {companion.image_url ? (
              <img 
                src={companion.image_url} 
                alt="Seraphine" 
                className="w-40 h-40 rounded-2xl object-cover border border-violet-700"
              />
            ) : (
              <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-5xl overflow-hidden border border-violet-700">
                🦊
              </div>
            )}
            
            <form action={generateCompanionImage}>
              <button
                type="submit"
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm flex items-center gap-2 transition"
              >
                Generate New Scene
              </button>
            </form>

            <p className="text-xs text-violet-400/80 mt-1">
              Current depth: {intimacyLabel}
            </p>
          </div>

          {/* Info */}
          <div className="text-center">
            <h2 className="text-2xl font-medium text-violet-300">{companion.name}</h2>
            <p className="text-zinc-400 text-sm mt-1">{companion.title || 'Quiet Flame'}</p>
          </div>

          {/* Personality */}
          <div className="pt-4 border-t border-zinc-800">
            <p className="text-zinc-400 text-sm leading-relaxed">
              {companion.personality_long || companion.personality}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-center pt-4 border-t border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500">Affinity</p>
              <p className="text-2xl font-medium text-violet-400">{companion.affinity_score}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Bond XP</p>
              <p className="text-2xl font-medium text-violet-400">{companion.bond_xp || 0}</p>
            </div>
          </div>

          {/* Intimacy note */}
          <div className="text-center pt-2">
            <p className="text-xs text-zinc-500 leading-relaxed">
              As your Affinity grows, Seraphine’s words and the scenes you can generate with her become deeper and more intimate.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
