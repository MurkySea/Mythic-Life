import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCompanionDef } from '@/lib/companions'
import { SKILL_LABELS } from '@/lib/skills'
import { resolveHeadshot } from '@/lib/staticAvatars'
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

  if (!companion) {
    redirect(`/companion-profile?c=${slug}&scene=error`)
  }

  const affinity = companion.affinity_score || 1
  const characterName = companion.name || def?.name || 'Seraphine'
  const earned = scenesEarned(affinity)

  const { count } = await supabase
    .from('gallery_images')
    .select('*', { count: 'exact', head: true })
    .eq('character_name', characterName)

  const used = count || 0
  if (used >= earned) {
    redirect(`/companion-profile?c=${slug}&scene=limit`)
  }

  const sceneIndex = used
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
    const imageUrl = data.data?.[0]?.url as string | undefined

    if (!response.ok || !imageUrl) {
      const msg = (data?.error?.message || data?.message || '').toString().toLowerCase()
      const blocked =
        msg.includes('safety') ||
        msg.includes('policy') ||
        msg.includes('blocked') ||
        msg.includes('refus') ||
        response.status === 400
      redirect(`/companion-profile?c=${slug}&scene=${blocked ? 'blocked' : 'error'}`)
    }

    await supabase.from('companion').update({ image_url: imageUrl }).eq('id', companion.id)
    await supabase.from('gallery_images').insert({
      character_name: characterName,
      image_url: imageUrl,
      affinity_at_generation: affinity,
      prompt_used: prompt,
    })

    revalidatePath('/companion-profile')
    revalidatePath('/companions')
    revalidatePath('/gallery')
    redirect(`/companion-profile?c=${slug}&scene=ok`)
  } catch (error) {
    console.error('Image generation error:', error)
    redirect(`/companion-profile?c=${slug}&scene=error`)
  }
}

function SceneBanner({ status }: { status?: string }) {
  if (!status) return null
  const map: Record<string, { text: string; className: string }> = {
    ok: {
      text: 'Scene claimed — it is in her gallery and on her profile.',
      className: 'border-emerald-700/50 bg-emerald-950/40 text-emerald-200',
    },
    limit: {
      text: 'No scene available yet — deepen affinity to earn the next milestone.',
      className: 'border-amber-700/50 bg-amber-950/40 text-amber-200',
    },
    blocked: {
      text: 'Image model declined this prompt (safety). Try again later or claim at a lower tier.',
      className: 'border-rose-700/50 bg-rose-950/40 text-rose-200',
    },
    error: {
      text: 'Scene generation failed — check GROK_API_KEY or try again.',
      className: 'border-zinc-600 bg-zinc-900 text-zinc-300',
    },
  }
  const item = map[status]
  if (!item) return null
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm mb-4 ${item.className}`}>{item.text}</div>
  )
}

export default async function CompanionProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; scene?: string }>
}) {
  const params = await searchParams
  const slug = params.c || ''
  const sceneStatus = params.scene

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
          {party.map(
            (c: {
              id: string
              name: string
              slug?: string
              image_url?: string
              affinity_score?: number
            }) => {
              const s = c.slug || (c.name === 'Seraphine' ? 'seraphine' : '')
              const def = getCompanionDef(s)
              const portrait = resolveHeadshot(s, c.image_url)
              return (
                <Link
                  key={c.id}
                  href={`/companion-profile?c=${s}`}
                  className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 hover:border-violet-600/40 transition text-center"
                >
                  {portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={portrait}
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
            }
          )}
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

  const characterName = companion?.name || def?.name || 'Seraphine'
  const affinity = companion?.affinity_score || 1
  const earned = scenesEarned(affinity)
  const nextAt = nextSceneMilestone(affinity)
  // Prefer claimed scene photo on profile; fall back to locked base avatar
  const portraitSrc = companion?.image_url || resolveHeadshot(slug, null)

  const [{ data: memories }, { count: sceneCount }] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .eq('role', 'companion')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('gallery_images')
      .select('*', { count: 'exact', head: true })
      .eq('character_name', characterName),
  ])

  const filteredMemories = (memories || [])
    .filter((m: { companion_slug?: string }) => {
      if (slug === 'seraphine') return !m.companion_slug || m.companion_slug === 'seraphine'
      return m.companion_slug === slug
    })
    .slice(0, 8)

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

      <SceneBanner status={sceneStatus} />

      {companion && (
        <div className="space-y-6">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col items-center">
              {portraitSrc ? (
                <div className="relative">
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-600/40 to-fuchsia-600/20 blur-sm" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={portraitSrc}
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
