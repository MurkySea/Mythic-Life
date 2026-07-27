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
import { loadPlayerState } from '@/lib/player-state'
import { readPartyMood } from '@/lib/engines/reactive-companions'
import { buildDailyChronicle, buildDailyHeadline } from '@/lib/engines/narrative'
import { getLeader } from '@/lib/engines/party'
import { getWorldIntegrity } from '@/lib/engines/world-integrity-wire'
import { BAND_LABEL, BAND_HINT } from '@/lib/engines/world-integrity'

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

function integrityColor(band: string): string {
  switch (band) {
    case 'flourishing':
      return 'text-emerald-400'
    case 'stable':
      return 'text-sky-400'
    case 'thinning':
      return 'text-amber-300'
    case 'strained':
      return 'text-orange-400'
    case 'fractured':
      return 'text-red-400'
    default:
      return 'text-zinc-300'
  }
}

function fmtDev(mins?: number): string {
  if (mins == null || Number.isNaN(mins)) return '—'
  const sign = mins > 0 ? '+' : ''
  return `${sign}${Math.round(mins)}m`
}

function fmtNum(n: number | null | undefined, digits = 0, suffix = ''): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${digits > 0 ? n.toFixed(digits) : Math.round(n)}${suffix}`
}

export default async function StandingPage() {
  const [health, persisted, playerState, partyMoodSnap, integrity] = await Promise.all([
    fetchLatestStanding(),
    loadStanding(),
    loadPlayerState(),
    readPartyMood().catch(() => null),
    getWorldIntegrity().catch(() => null),
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

  const leaderSlug = getLeader(playerState.party)?.slug
  const speakerName =
    (leaderSlug && getCompanionDef(leaderSlug)?.name) ||
    (leaderSlug === 'seraphine' ? 'Seraphine' : null) ||
    'Someone who follows you'

  const chronicle = buildDailyChronicle({
    date: health?.date,
    rhythmTier: rhythm?.tier || persisted.last_rhythm_tier,
    shadowDebt: persisted.shadow_debt,
    selfNeglect: neglect.severity,
    partyMood: partyMoodSnap?.mood ?? null,
    speakerName,
    taskCountHint: (recentTasks || []).length,
  })
  const headline = buildDailyHeadline({
    rhythmTier: rhythm?.tier || persisted.last_rhythm_tier,
    shadowDebt: persisted.shadow_debt,
    partyMood: partyMoodSnap?.mood ?? null,
  })

  const hasSleepStages =
    sleep &&
    (sleep.deep != null || sleep.rem != null || sleep.core != null)

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
        {/* Chronicle + World Integrity */}
        <section className="rounded-2xl border border-violet-900/40 bg-gradient-to-b from-violet-950/30 to-zinc-900/80 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-violet-400/80">Chronicle</p>
              <p className="text-sm text-violet-100/90 font-medium leading-snug mt-0.5">{headline}</p>
            </div>
            {integrity && (
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Integrity</p>
                <p className={`text-2xl font-medium tabular-nums ${integrityColor(integrity.band)}`}>
                  {integrity.value}
                </p>
                <p className={`text-[11px] ${integrityColor(integrity.band)}`}>
                  {BAND_LABEL[integrity.band]}
                </p>
              </div>
            )}
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{chronicle}</p>
          {integrity && (
            <p className="text-[11px] text-zinc-500 leading-relaxed">{BAND_HINT[integrity.band]}</p>
          )}
        </section>

        {/* Core standing numbers */}
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

        {/* Multiplier stack */}
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

        {/* Rhythm + sleep — full metrics */}
        {rhythm ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4">
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
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">
                  {sleep.bedtimeDisplay || '—'} → {sleep.wakeDisplay || '—'}
                  {sleep.totalHours != null && (
                    <span className="text-zinc-300"> · {sleep.totalHours.toFixed(1)}h</span>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Bed deviation</p>
                    <p className="text-zinc-200 tabular-nums">{fmtDev(rhythm.bedDeviationMinutes)}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Wake deviation</p>
                    <p className="text-zinc-200 tabular-nums">{fmtDev(rhythm.wakeDeviationMinutes)}</p>
                  </div>
                </div>
              </div>
            )}

            {hasSleepStages && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Sleep stages</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-2 py-2">
                    <p className="text-[10px] text-zinc-500">Deep</p>
                    <p className="text-sm text-indigo-300 tabular-nums">{fmtNum(sleep?.deep, 1, 'h')}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-2 py-2">
                    <p className="text-[10px] text-zinc-500">REM</p>
                    <p className="text-sm text-violet-300 tabular-nums">{fmtNum(sleep?.rem, 1, 'h')}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-2 py-2">
                    <p className="text-[10px] text-zinc-500">Core</p>
                    <p className="text-sm text-sky-300 tabular-nums">{fmtNum(sleep?.core, 1, 'h')}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Rhythm effects</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                  <p className="text-[10px] text-zinc-500">Reward efficiency</p>
                  <p className="text-zinc-200 tabular-nums">{rhythm.rewardEfficiency.toFixed(2)}×</p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                  <p className="text-[10px] text-zinc-500">Token multiplier</p>
                  <p className="text-zinc-200 tabular-nums">
                    {rhythm.consistencyTokenMultiplier.toFixed(2)}×
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                  <p className="text-[10px] text-zinc-500">Shadow debt Δ</p>
                  <p
                    className={`tabular-nums ${
                      rhythm.shadowDebtDelta > 0
                        ? 'text-amber-400'
                        : rhythm.shadowDebtDelta < 0
                          ? 'text-emerald-400'
                          : 'text-zinc-200'
                    }`}
                  >
                    {rhythm.shadowDebtDelta > 0 ? '+' : ''}
                    {rhythm.shadowDebtDelta}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                  <p className="text-[10px] text-zinc-500">Leader trust Δ</p>
                  <p
                    className={`tabular-nums ${
                      rhythm.leaderTrustDelta > 0
                        ? 'text-emerald-400'
                        : rhythm.leaderTrustDelta < 0
                          ? 'text-red-400'
                          : 'text-zinc-200'
                    }`}
                  >
                    {rhythm.leaderTrustDelta > 0 ? '+' : ''}
                    {rhythm.leaderTrustDelta}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-5 py-6 text-center">
            <p className="text-zinc-500 text-sm">No rhythm data yet.</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Connect health export / MYTHIC_DATA_URL to score nights.
            </p>
          </section>
        )}

        {/* Body signals — full set */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Body signals</p>
          {signals ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500">Stress</p>
                  <p className="text-sm font-medium text-zinc-200 capitalize">{signals.stressProxy}</p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500">Recovery</p>
                  <p className="text-sm font-medium text-zinc-200 capitalize">{signals.recoveryProxy}</p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500">HRV</p>
                  <p className="text-sm font-medium text-zinc-200 tabular-nums">
                    {fmtNum(signals.hrv, 0, ' ms')}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500">Resting HR</p>
                  <p className="text-sm font-medium text-zinc-200 tabular-nums">
                    {fmtNum(signals.restingHeartRate, 0, ' bpm')}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500">Steps</p>
                  <p className="text-sm font-medium text-zinc-200 tabular-nums">
                    {signals.steps != null ? signals.steps.toLocaleString() : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                  <p className="text-[10px] text-zinc-500">Active energy</p>
                  <p className="text-sm font-medium text-zinc-200 tabular-nums">
                    {fmtNum(signals.activeEnergyKcal, 0, ' kcal')}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-600">No body signals for this window.</p>
          )}
        </section>

        {/* Self-neglect */}
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

        {/* Domains */}
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

        {/* Token sinks */}
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

        {/* Party trust */}
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

        <p className="text-center text-[11px] text-zinc-600 pt-1">
          {health?.date ? `Rhythm scored for ${health.date}` : 'Domains from last 3 days'}
        </p>
      </div>
    </main>
  )
}
