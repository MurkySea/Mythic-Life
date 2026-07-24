import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'
import { aggregateDomains, detectSelfNeglect, debtToMultiplier } from '@/lib/engines/ontology'
import { loadStanding } from '@/lib/engines/standing-store'
import { TOKEN_SINKS } from '@/lib/engines/sinks'
import { buySink } from './actions'
import type { LifeDomain } from '@/lib/engines/types'
import { getCompanionDef } from '@/lib/companions'
import { parseDomains } from '@/lib/skills'

export const dynamic = 'force-dynamic'

const DOMAIN_LABELS: Record<LifeDomain, string> = {
  self: 'Self',
  relationship: 'Relationship',
  stewardship: 'Stewardship',
  domain: 'Domain',
  legacy: 'Legacy',
}

const DOMAIN_ORDER: LifeDomain[] = [
  'self',
  'relationship',
  'stewardship',
  'domain',
  'legacy',
]

function moodFromAffinity(aff: number): string {
  if (aff >= 16) return 'devoted'
  if (aff >= 10) return 'steady'
  if (aff >= 5) return 'concerned'
  if (aff >= 2) return 'disappointed'
  return 'withdrawn'
}

export default async function StandingPage() {
  const [health, persisted] = await Promise.all([
    fetchLatestStanding(),
    loadStanding(),
  ])

  const rhythm = health?.rhythm
  const sleep = health?.sleep
  const signals = health?.signals
  const tier = tierStyle(rhythm?.tier)

  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - 3)
  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('title, domains, domain, is_completed, completed_at')
    .eq('is_completed', true)
    .gte('completed_at', since.toISOString())
    .limit(80)

  const tags: string[] = []
  const titles: string[] = []
  for (const t of recentTasks || []) {
    tags.push(...parseDomains(t.domains, t.domain))
    if (t.title) titles.push(t.title)
  }
  const aggregates = aggregateDomains(tags, { titles })
  const neglect = detectSelfNeglect(aggregates)
  const maxDomain = Math.max(1, ...Object.values(aggregates))

  const { data: companions } = await supabase
    .from('companion')
    .select('id, name, slug, affinity_score, is_unlocked')
    .or('is_unlocked.eq.true,is_unlocked.is.null')
    .order('affinity_score', { ascending: false })

  const party = (companions || []).map((c) => {
    const slug =
      c.slug ||
      (c.name === 'Seraphine' ? 'seraphine' : c.name?.toLowerCase().replace(/\s+/g, '_') || '')
    const aff = c.affinity_score || 1
    return {
      slug,
      name: c.name || slug,
      affinity: aff,
      mood: moodFromAffinity(aff),
      emoji: getCompanionDef(slug)?.emoji || '✦',
    }
  })

  const debtForMul = Math.max(0, persisted.shadow_debt || 0)
  const rhythmMul = rhythm?.rewardEfficiency ?? 1
  const debtMul = debtToMultiplier(debtForMul)
  const selfMul = neglect.selfMultiplier
  const combined = Math.max(0.55, Number((rhythmMul * debtMul * selfMul).toFixed(3)))

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-12 min-h-screen">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors mb-3"
        >
          ← Home
        </Link>
        <p className="text-zinc-500 text-xs tracking-wide uppercase">Health & Consistency</p>
        <h1 className="text-2xl font-medium text-white tracking-tight">Standing</h1>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">XP</p>
              <p className="text-sm font-medium text-violet-300 tabular-nums">
                {Math.round(persisted.total_xp)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Gold</p>
              <p className="text-sm font-medium text-amber-300 tabular-nums">
                {Math.round(persisted.total_gold)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Tokens</p>
              <p className="text-sm font-medium text-sky-300 tabular-nums">
                {persisted.consistency_tokens.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Debt</p>
              <p
                className={`text-sm font-medium tabular-nums ${
                  persisted.shadow_debt > 0 ? 'text-amber-400' : 'text-zinc-300'
                }`}
              >
                {persisted.shadow_debt.toFixed(0)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Overall multiplier</p>
              <p className="text-3xl font-medium text-white tabular-nums mt-0.5">{combined}×</p>
            </div>
            <div className="text-right text-xs text-zinc-500 space-y-0.5">
              <p>Rhythm {rhythmMul.toFixed(2)}×</p>
              <p>Debt {debtMul.toFixed(2)}×</p>
              <p>Self {selfMul.toFixed(2)}×</p>
            </div>
          </div>
        </section>

        {rhythm ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Rhythm</p>
                <p className={`text-2xl font-medium mt-0.5 ${tier.color}`}>{tier.label}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Contribution</p>
                <p className="text-lg font-medium text-white tabular-nums">
                  {rhythm.contribution > 0 ? '+' : ''}
                  {rhythm.contribution}
                </p>
              </div>
            </div>
            {sleep && (
              <p className="text-xs text-zinc-500">
                {sleep.bedtimeDisplay || '—'} → {sleep.wakeDisplay || '—'}
                {sleep.totalHours != null && ` · ${sleep.totalHours.toFixed(1)}h`}
              </p>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-5 py-6 text-center">
            <p className="text-zinc-500 text-sm">No rhythm data yet.</p>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Self health</p>
            <p
              className={`text-sm font-medium capitalize ${
                neglect.severity === 'none'
                  ? 'text-emerald-400'
                  : neglect.severity === 'mild'
                    ? 'text-sky-400'
                    : neglect.severity === 'moderate'
                      ? 'text-amber-400'
                      : 'text-red-400'
              }`}
            >
              {neglect.severity === 'none' ? 'Healthy' : neglect.severity}
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            Self {neglect.selfScore} / total {neglect.totalScore} · ratio{' '}
            {(neglect.ratio * 100).toFixed(0)}%
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Domains (3-day)</p>
          <div className="space-y-2.5">
            {DOMAIN_ORDER.map((d) => {
              const score = aggregates[d] || 0
              const pct = Math.min(100, (score / maxDomain) * 100)
              return (
                <div key={d}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">{DOMAIN_LABELS[d]}</span>
                    <span className="text-zinc-500 tabular-nums">{score.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-violet-500/80 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Token sinks — extras only */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Token sinks</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Extras only. Never required for core play.</p>
          </div>
          <div className="space-y-2">
            {TOKEN_SINKS.map((s) => {
              const canAfford = persisted.consistency_tokens >= s.cost
              return (
                <form key={s.id} action={buySink} className="flex items-center justify-between gap-3">
                  <input type="hidden" name="sink_id" value={s.id} />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200">{s.label}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{s.blurb}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={!canAfford}
                    className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                      canAfford
                        ? 'border-sky-700/50 bg-sky-950/40 text-sky-300 hover:border-sky-500'
                        : 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    {s.cost} tok
                  </button>
                </form>
              )
            })}
          </div>
        </section>

        {party.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Party trust</p>
            <div className="space-y-2">
              {party.slice(0, 6).map((c) => (
                <div key={c.slug} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{c.emoji}</span>
                    <span className="text-sm text-zinc-200 truncate">{c.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400 capitalize">{c.mood}</p>
                    <p className="text-[11px] text-zinc-600 tabular-nums">aff {c.affinity}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {signals && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Body signals</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] text-zinc-500">Stress</p>
                <p className="font-medium text-zinc-200 capitalize">{signals.stressProxy}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Recovery</p>
                <p className="font-medium text-zinc-200 capitalize">{signals.recoveryProxy}</p>
              </div>
            </div>
          </section>
        )}

        <p className="text-center text-[11px] text-zinc-600 pt-1">
          {health?.date ? `Rhythm scored for ${health.date}` : 'Domains from last 3 days'}
        </p>
      </div>
    </main>
  )
}
