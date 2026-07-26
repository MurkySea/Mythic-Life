import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { COMPANION_DEFS, meetsUnlock, getCompanionDef } from '@/lib/companions'
import { SKILL_LABELS, skillLevelFromXp } from '@/lib/skills'
import { loadPlayerState, MAX_PARTY_SIZE } from '@/lib/player-state'
import {
  actionJoinParty,
  actionLeaveParty,
  actionSetLeader,
  actionTogglePartyLock,
} from '../mode-actions'

export const dynamic = 'force-dynamic'

export default async function CompanionsPage() {
  const supabase = await createClient()
  const [{ data: rows }, { data: skills }, player] = await Promise.all([
    supabase.from('companion').select('*'),
    supabase.from('player_skills').select('*'),
    loadPlayerState(),
  ])

  const { party } = player
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

  const activePartySlugs = new Set(party.members.map((m) => m.slug))
  const leaderSlug = party.members.find((m) => m.isLeader)?.slug

  const roster = COMPANION_DEFS.filter((d) => d.starter || unlockedSlugs.has(d.slug))
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

      {/* ── Active Party of 5 ── */}
      <div className="bg-violet-950/30 border border-violet-800/40 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold">
              Active Party
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {party.members.length} / {MAX_PARTY_SIZE}
              {party.locked ? ' · locked' : ''}
            </p>
          </div>
          <form action={actionTogglePartyLock}>
            <button
              type="submit"
              className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white transition"
            >
              {party.locked ? 'Unlock' : 'Lock'}
            </button>
          </form>
        </div>

        {party.members.length === 0 ? (
          <p className="text-sm text-zinc-500 py-2">
            No one in the active party yet. Add up to 5 from the roster below.
          </p>
        ) : (
          <div className="space-y-2">
            {party.members.map((m) => {
              const def = getCompanionDef(m.slug)
              if (!def) return null
              return (
                <div
                  key={m.slug}
                  className="flex items-center gap-3 bg-zinc-950/60 rounded-xl p-3 border border-zinc-800"
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-900/40 border border-violet-700/40 flex items-center justify-center text-xl">
                    {def.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-violet-200 truncate">
                      {def.name}
                      {m.isLeader && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wider text-amber-400">
                          Leader
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500">{def.title}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {!m.isLeader && (
                      <form action={actionSetLeader}>
                        <input type="hidden" name="slug" value={m.slug} />
                        <button
                          type="submit"
                          className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-amber-300"
                          disabled={party.locked}
                        >
                          Lead
                        </button>
                      </form>
                    )}
                    <form action={actionLeaveParty}>
                      <input type="hidden" name="slug" value={m.slug} />
                      <button
                        type="submit"
                        className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-red-300"
                        disabled={party.locked}
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
        The active party (max 5) receives Trust updates and dialogue priority. The full roster stays
        available; only the active five are “with you” day to day.
      </p>

      <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">
        Roster ({roster.length})
      </p>
      <div className="space-y-2 mb-8">
        {roster.map((c) => {
          const db = rows?.find((r) => r.slug === c.slug || r.name === c.name)
          const inParty = activePartySlugs.has(c.slug)
          const canJoin = !inParty && party.members.length < MAX_PARTY_SIZE && !party.locked

          return (
            <div
              key={c.slug}
              className={`bg-zinc-900/80 border rounded-2xl p-4 ${
                inParty ? 'border-violet-700/50' : 'border-zinc-800'
              }`}
            >
              <Link href={`/companion-profile?c=${c.slug}`} className="block hover:opacity-95">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-900/40 border border-violet-700/40 flex items-center justify-center text-2xl">
                    {c.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-violet-200 truncate">
                        {c.name}
                        {c.slug === leaderSlug && (
                          <span className="ml-1.5 text-[10px] text-amber-400">★</span>
                        )}
                      </p>
                      <span
                        className={`text-[10px] uppercase tracking-wider shrink-0 ${rarityColor(c.rarity)}`}
                      >
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
                    <span
                      key={a}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                    >
                      {SKILL_LABELS[a]}
                    </span>
                  ))}
                </div>
              </Link>

              <div className="flex gap-3 mt-3 text-xs items-center">
                <Link href={`/companion-profile?c=${c.slug}`} className="text-violet-400">
                  Profile →
                </Link>
                <Link
                  href={`/messages?c=${c.slug}`}
                  className="text-zinc-500 hover:text-violet-300"
                >
                  Message →
                </Link>
                {inParty ? (
                  <span className="ml-auto text-[10px] text-violet-400/80">In party</span>
                ) : canJoin ? (
                  <form action={actionJoinParty} className="ml-auto">
                    <input type="hidden" name="slug" value={c.slug} />
                    <button
                      type="submit"
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-900/60 border border-violet-700/50 text-violet-200 hover:bg-violet-800/60"
                    >
                      Add to party
                    </button>
                  </form>
                ) : party.members.length >= MAX_PARTY_SIZE ? (
                  <span className="ml-auto text-[10px] text-zinc-600">Party full</span>
                ) : null}
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
                ready
                  ? 'border-amber-700/40 bg-amber-950/10'
                  : 'border-zinc-800/60 bg-zinc-950/60 opacity-80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl grayscale">
                  {c.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <p className="font-medium text-zinc-400">{c.name}</p>
                    <span className={`text-[10px] uppercase ${rarityColor(c.rarity)}`}>
                      {c.rarity}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {c.race} · {c.className}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {ready
                      ? 'Requirements met — complete a task or open Today to bond'
                      : `Needs ${Object.entries(c.unlock)
                          .map(
                            ([k, v]) =>
                              `${SKILL_LABELS[k as keyof typeof SKILL_LABELS]} ${v}`
                          )
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
