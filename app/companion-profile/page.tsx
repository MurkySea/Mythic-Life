import { createClient } from '@/utils/supabase/server'
import { getScenePrompt } from '../actions'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

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
        model: 'grok-imagine-image',
        prompt,
        n: 1,
      }),
    })

    const data = await response.json()
    const imageUrl = data.data?.[0]?.url

    if (imageUrl) {
      await supabase
        .from('companion')
        .update({ image_url: imageUrl })
        .eq('name', characterName)

      await supabase.from('gallery_images').insert({
        character_name: characterName,
        image_url: imageUrl,
        affinity_at_generation: affinity,
        prompt_used: prompt,
      })
    }
  } catch (error) {
    console.error('Image generation error:', error)
  }

  revalidatePath('/companion-profile')
  revalidatePath('/companion')
  revalidatePath('/gallery')
}

function getIntimacyLabel(affinity: number): string {
  if (affinity >= 20) return 'Intense & Sensual'
  if (affinity >= 16) return 'Heated Intimacy'
  if (affinity >= 12) return 'Deeply Intimate'
  if (affinity >= 9) return 'Close & Tender'
  if (affinity >= 6) return 'Warming Bond'
  if (affinity >= 3) return 'Growing Familiar'
  return 'Quiet Companion'
}

export default async function CompanionProfilePage() {
  const supabase = await createClient()

  const { data: companion } = await supabase.from('companion').select('*').single()

  const { data: memories } = await supabase
    .from('messages')
    .select('*')
    .eq('role', 'companion')
    .order('created_at', { ascending: false })
    .limit(8)

  const affinity = companion?.affinity_score || 1

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <a
          href="/"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition"
        >
          ←
        </a>
        <div className="flex-1">
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Your companion</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Profile</h1>
        </div>
        <Link href="/settings" className="text-xs text-zinc-500 hover:text-violet-400">
          Settings
        </Link>
      </div>

      {companion && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col items-center">
              {companion.image_url ? (
                <div className="relative">
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-600/40 to-fuchsia-600/20 blur-sm" />
                  <img
                    src={companion.image_url}
                    alt={companion.name}
                    className="relative w-36 h-36 rounded-2xl object-cover border border-violet-500/30"
                  />
                </div>
              ) : (
                <div className="w-36 h-36 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-6xl">
                  🦊
                </div>
              )}

              <h2 className="mt-5 text-2xl font-medium text-violet-300 tracking-tight">
                {companion.name}
              </h2>
              <p className="text-zinc-500 text-sm mt-1">{companion.title || 'Quiet Flame'}</p>
              <p className="text-violet-400/70 text-xs mt-2 tracking-wide">
                {getIntimacyLabel(affinity)}
              </p>

              <form action={generateCompanionImage} className="mt-5">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 active:scale-95 rounded-xl text-sm font-medium transition"
                >
                  Generate New Scene
                </button>
              </form>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950/70 rounded-2xl p-4 text-center border border-zinc-800/50">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Affinity</p>
                <p className="text-3xl font-medium text-violet-400 mt-1">{companion.affinity_score}</p>
              </div>
              <div className="bg-zinc-950/70 rounded-2xl p-4 text-center border border-zinc-800/50">
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Bond XP</p>
                <p className="text-3xl font-medium text-violet-400 mt-1">{companion.bond_xp || 0}</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">About her</p>
              <p className="text-zinc-400 text-[15px] leading-relaxed">
                {companion.personality_long || companion.personality}
              </p>
            </div>
          </div>

          <Link
            href="/companions"
            className="block bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 text-center text-sm text-violet-300 hover:border-violet-700/50 transition"
          >
            View all companions →
          </Link>

          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3 px-1">
              Sweet Moments & Memories
            </p>
            <div className="space-y-3">
              {memories && memories.length > 0 ? (
                memories.map((msg: any) => (
                  <div
                    key={msg.id}
                    className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 text-[14px] text-zinc-300 leading-relaxed"
                  >
                    {msg.content}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-zinc-600 text-sm">
                  Complete tasks and talk with her.
                  <br />
                  Sweet moments will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
