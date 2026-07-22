import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getCompanionDef } from '@/lib/companions'
import { SKILL_LABELS } from '@/lib/skills'
import { checkAndUnlockCompanions } from '../actions'
import {
  buildScenePrompt,
  scenesEarned,
  nextSceneMilestone,
  getIntimacyLabel,
  SCENE_MILESTONES,
} from '@/lib/scenes'

export const dynamic = 'force-dynamic'

async function generateCompanionImage(formData: FormData) {
  'use server'

  const slug = (formData.get('slug') as string) || 'seraphine'
  const supabase = await createClient()
  const def = getCompanionDef(slug)

  const { data: companion } = await supabase
    .from('companion')
    .select('id, affinity_score, name, slug, image_url')
    .or(`slug.eq.${slug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  if (!companion) return

  const affinity = companion.affinity_score || 1
  const characterName = companion.name || def?.name || 'Seraphine'
  const earned = scenesEarned(affinity)

  // Count scenes already generated for this character
  const { count } = await supabase
    .from('gallery_images')
    .select('*', { count: 'exact', head: true })
    .eq('character_name', characterName)

  const used = count || 0
  if (used >= earned) {
    // No free scene slot — do nothing (UI should hide the button)
    revalidatePath('/companion-profile')
    return
  }

  const sceneIndex = used // 0-based which milestone we're claiming
  const prompt = buildScenePrompt(affinity, def, sceneIndex)

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
    const imageUrl = data.data?.[0]?.url

    if (imageUrl) {
      await supabase.from('companion').update({ image_url: imageUrl }).eq('id', companion.id)
      await supabase.from('gallery_images').insert({
        character_name: characterName,
        image_url: imageUrl,
        affinity_at_generation: affinity,
        prompt_used: prompt,
        scene_index: sceneIndex,
      })
    }
  } catch (error) {
    console.error('Image generation error:', error)
  }

  revalidatePath('/companion-profile')
  revalidatePath('/companions')
  revalidatePath('/gallery')
}

export default async function CompanionProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  await checkAndUnlockCompanions()
  const params = await searchParams
  const slug = params.c || ''

  const supabase = await createClient()
  const { data: all } = await supabase
    .from('companion')
    .select('*')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const party = all || []

  if (!slug) {
    return (
      <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            ←
          </Link>
          <div className="flex-1">
            <p className="text-zinc-500 text-xs tracking-wide uppercase">Party</p>
            <h1 className="text-xl font-medium text-white tracking-tight">Profiles</h1>
          </div>
          <Link href="/companions" className="text-xs text-violet-400">
            Roster
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {party.map((c: { id: string; name: string; slug?: string; image_url?: string; affinity_score?: number }) => {
            const s = c.slug || (c.name === 'Seraphine' ? 'seraphine' : '')
            const def = getCompanionDef(s)
            return (
              <Link
                key={c.id}
                href={`/companion-profile?c=${s}`}
                className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 hover:border-violet-600/40 transition text-center"
              >
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="w-20 h-20 rounded-xl object-cover mx-auto border border-violet-500/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-violet-900/40 mx-auto flex items-center justify-center text-3xl">
                    {def?.emoji || '✦'}
                  </div>
                )}
                <p className="mt-3 font-medium text-violet-200 text-sm">{c.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">Affinity {c.affinity_score || 1}</p>
              </Link>
            )
          })}
        </div>

        <Link
          href="/companions"
          className="block mt-6 text-center text-sm text-zinc-500 hover:text-violet-300"
        >
          See locked companions →
        </Link>
      </main>
    )
  }

  const def = getCompanionDef(slug)
  const companion =
    party.find((c: { slug?: string; name: string }) => c.slug === slug || c.name === def?.name) ||
    party.find((c: { name: string }) => c.name === 'Seraphine')

  const { data: memories } = await supabase
    .from('messages')
    .select('*')
    .eq('role', 'companion')
    .order('created_at', { ascending: false })
    .limit(20)

  const filteredMemories = (memories || [])
    .filter((m: { companion_slug?: string }) => {
      if (slug === 'seraphine') return !m.companion_slug || m.companion_slug === 'seraphine'
      return m.companion_slug === slug
    })
    .slice(0, 8)

  const affinity = companion?.affinity_score || 1
  const characterName = companion?.name || def?.name || 'Seraphine'
  const earned = scenesEarned(affinity)
  const nextAt = nextSceneMilestone(affinity)

  const { count: sceneCount } = await supabase
    .from('gallery_images')
    .select('*', { count: 'exact', head: true })
    .eq('character_name', characterName)

  const used = sceneCount || 0
  const canGenerate = used < earned

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/companion-profile"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div className="flex-1">
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Companion</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Profile</h1>
        </div>
        <Link href={`/messages?c=${slug}`} className="text-xs text-violet-400">
          Message
        </Link>
      </div>

      {companion && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col items-center">
              {companion.image_url ? (
                <div className="relative">
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-600/40 to-fuchsia-600/20 blur-sm" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={companion.image_url}
                    alt={companion.name}
                    className="relative w-36 h-36 rounded-2xl object-cover border border-violet-500/30"
                  />
                </div>
              ) : (
                <div className="w-36 h-36 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-6xl">
                  {def?.emoji || '🦊'}
                </div>
              )}

              <h2 className="mt-5 text-2xl font-medium text-violet-300 tracking-tight">
                {companion.name}
              </h2>
              <p className="text-zinc-500 text-sm mt-1">
                {companion.title || def?.title || 'Companion'}
              </p>
              <p className="text-violet-400/70 text-xs mt-2 tracking-wide">
                {getIntimacyLabel(affinity)}
              </p>
              {def && (
                <p className="text-[11px] text-zinc-600 mt-1">
                  {def.race} · {def.className}
                </p>
              )}

              {/* Scene economy */}
              <div className="mt-5 w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-center">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Scenes</p>
                <p className="text-lg text-white mt-1">
                  {used} <span className="text-zinc-500 text-sm">/ {earned} earned</span>
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {canGenerate
                    ? 'A new scene is available — claim it.'
                    : nextAt
                      ? `Next scene unlocks at Affinity ${nextAt}`
                      : 'All current milestones claimed'}
                </p>
                <div className="flex justify-center gap-1 mt-3">
                  {SCENE_MILESTONES.map((m, i) => (
                    <div
                      key={m}
                      title={`Affinity ${m}`}
                      className={`h-1.5 w-6 rounded-full ${
                        i < used
                          ? 'bg-violet-500'
                          : i < earned
                            ? 'bg-violet-500/40'
                            : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {canGenerate ? (
                <form action={generateCompanionImage} className="mt-4">
                  <input type="hidden" name="slug" value={slug} />
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 active:scale-95 rounded-xl text-sm font-medium transition"
                  >
                    Claim Scene {used + 1}
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-xs text-zinc-600 text-center max-w-[240px]">
                  Deepen the bond through tasks and conversation to unlock the next scene.
                </p>
              )}
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

            {def && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {def.affinities.map((a) => (
                  <span
                    key={a}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                  >
                    {SKILL_LABELS[a]}
                  </span>
                ))}
              </div>
            )}

            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">About</p>
              <p className="text-zinc-400 text-[15px] leading-relaxed">
                {companion.personality_long || companion.personality || def?.personality}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3 px-1">Memories</p>
            <div className="space-y-3">
              {filteredMemories.length > 0 ? (
                filteredMemories.map((msg: { id: string; content: string }) => (
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
                  Moments will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
