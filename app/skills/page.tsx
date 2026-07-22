import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { SKILLS, SKILL_LABELS, xpIntoLevel } from '@/lib/skills'
import { COMPANION_DEFS, meetsUnlock } from '@/lib/companions'

export const dynamic = 'force-dynamic'

export default async function SkillsPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('player_skills').select('*')

  const xpMap: Record<string, number> = {}
  const levelMap: Record<string, number> = {}
  for (const r of rows || []) {
    xpMap[r.skill] = r.xp || 0
    levelMap[r.skill] = r.level || xpIntoLevel(r.xp || 0).level
  }

  const lockedNearby = COMPANION_DEFS.filter((c) => !c.starter).map((c) => {
    const ready = meetsUnlock(c.unlock, levelMap)
    return { ...c, ready }
  })

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div>
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Progression</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Skills</h1>
        </div>
      </div>

      <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
        Each domain grows on its own. Tasks can feed multiple skills — Quiet Time can raise both Faith and
        Discipline. Companions unlock when your levels meet their thresholds.
      </p>

      <div className="space-y-3 mb-10">
        {SKILLS.map((key) => {
          const xp = xpMap[key] || 0
          const { level, into, need } = xpIntoLevel(xp)
          const pct = Math.min(100, (into / need) * 100)
          return (
            <div key={key} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-medium text-white">{SKILL_LABELS[key]}</span>
                <span className="text-violet-300 text-sm">Level {level}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                {into} / {need} XP · {xp} total
              </p>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Unlock progress</p>
      <div className="space-y-2">
        {lockedNearby.map((c) => (
          <div
            key={c.slug}
            className={`rounded-2xl border p-4 ${
              c.ready
                ? 'border-violet-600/40 bg-violet-950/20'
                : 'border-zinc-800 bg-zinc-950/50'
            }`}
          >
            <div className="flex justify-between">
              <p className={`font-medium ${c.ready ? 'text-violet-200' : 'text-zinc-400'}`}>{c.name}</p>
              <span className="text-[10px] text-zinc-500">{c.ready ? 'Ready' : 'Locked'}</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Needs:{' '}
              {Object.entries(c.unlock)
                .map(([k, v]) => `${SKILL_LABELS[k as keyof typeof SKILL_LABELS] || k} ${v}`)
                .join(' · ') || '—'}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
