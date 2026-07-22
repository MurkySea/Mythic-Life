import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { COMPANION_DEFS, meetsUnlock } from '@/lib/companions'
import { SKILL_LABELS, skillLevelFromXp } from '@/lib/skills'
import { checkAndUnlockCompanions } from '../actions'

export const dynamic = 'force-dynamic'

export default async function CompanionsPage() {
  await checkAndUnlockCompanions()

  const supabase = await createClient()
  const { data: rows } = await supabase.from('companion').select('*')
  const { data: skills } = await supabase.from('player_skills').select('*')

  const levelMap: Record<string, number> = {}
  for (const s of skills || []) {
    levelMap[s.skill] = s.level || skillLevelFromXp(s.xp || 0)
  }

  const unlockedSlugs = new Set(
    (rows || [])
      .filter((c) => c.is_unlocked !== false)
      .map((c) => c.slug || (c.name === 'Seraphine' ? 'seraphine' : ''))
      .filter(Boolean)
  )

  unlockedSlugs.add('seraphine')

  const active = COMPANION_DEFS.filter((d) => d.starter || unlockedSlugs.has(d.slug))
  const locked = COMPANION_DEFS.filter((d) => !d.starter && !unlockedSlugs.has(d.slug))

  function rarityColor(r: string) {
    if (r === 'Legendary' || r === 'Founding') return 'text-amber-300'
    if (r === 'SSR') return 'text-orange-300'
    if (r === 'Epic') return 'text-violet-300'
    return 'text-zinc-400'
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div>
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Your party</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Companions</h1>
        </div>
      </div>

      <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
        Companions unlock as your skills grow. Raise Faith, Discipline, Fitness, and the rest — they notice
        who you are becoming.
      </p>

      <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
        Active ({active.length})
      </p>
      <div className="space-y-2 mb-8">
        {active.map((c) => {
          const db = rows?.find((r) => r.slug === c.slug || r.name === c.name)
          return (
            <div
              key={c.slug}
              className="bg-zinc-900/80 border border-violet-800/40 rounded-2xl p-4"
            >
              <Link href={`/companion-profile?c=${c.slug}`} className="block hover:opacity-95">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-700/40 flex items-center justify-center text-2xl">
                    {c.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-violet-200 truncate">{c.name}</p>
                      <span className={`text-[10px] uppercase tracking-wider shrink-0 ${rarityColor(c.rarity)}`}>
                        {c.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {c.race} · {c.className}
                    </p>
                    {db && (
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Affinity {db.affinity_score || 1} · Bond {db.bond_xp || 0}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {c.affinities.map((a) => (
                    <span key={a} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                      {SKILL_LABELS[a]}
                    </span>
                  ))}
                </div>
              </Link>
              <div className="flex gap-3 mt-3 text-xs">
                <Link href={`/companion-profile?c=${c.slug}`} className="text-violet-400">
                  Profile →
                </Link>
                <Link href={`/messages?c=${c.slug}`} className="text-zinc-500 hover:text-violet-300">
                  Message →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Not yet unlocked</p>
      <div className="space-y-2">
        {locked.map((c) => {
          const ready = meetsUnlock(c.unlock, levelMap)
          return (
            <div
              key={c.slug}
              className={`rounded-2xl border p-4 ${
                ready ? 'border-amber-700/40 bg-amber-950/10' : 'border-zinc-800/60 bg-zinc-950/60 opacity-80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl grayscale">
                  {c.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="font-medium text-zinc-400">{c.name}</p>
                    <span className={`text-[10px] uppercase ${rarityColor(c.rarity)}`}>{c.rarity}</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {c.race} · {c.className}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {ready
                      ? 'Requirements met — open the app again to bond'
                      : `Needs ${Object.entries(c.unlock)
                          .map(([k, v]) => `${SKILL_LABELS[k as keyof typeof SKILL_LABELS]} ${v}`)
                          .join(', ')}`}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
