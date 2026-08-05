import Link from 'next/link'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'
import { loadStanding } from '@/lib/engines/standing-store'
import { aggregateDomains, detectSelfNeglect } from '@/lib/engines/ontology'
import { createClient } from '@/utils/supabase/server'
import { parseDomains } from '@/lib/skills'
import { StandingTabs } from '../StandingTabs'
import {
  scoreNightWithLadder,
  progressFromStanding,
  chicagoMinutesFromMidnight,
} from '@/lib/engines/baseline-wire'
import { getPhase, type DailyTier } from '@/lib/engines/personal-baseline'

export const dynamic = 'force-dynamic'

function fmtDev(mins?: number | null): string {
  if (mins == null || Number.isNaN(mins)) return '—'
  if (mins === 0) return '0m'
  const sign = mins > 0 ? '+' : ''
  return `${sign}${Math.round(mins)}m`
}

function fmtNum(n: number | null | undefined, digits = 0, suffix = ''): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${digits > 0 ? n.toFixed(digits) : Math.round(n)}${suffix}`
}

/** Ladder contribution aligned with old export scale, keyed by phase tier. */
function ladderContribution(tier: DailyTier | string | undefined): number {
  switch (tier) {
    case 'Excellent':
      return 12
    case 'Good':
      return 7
    case 'Neutral':
      return 0
    case 'Poor':
      return -4
    case 'Bad':
      return -9
    default:
      return 0
  }
}

/**
 * Minutes past the phase late-edge (one-sided). 0 if at or before the edge.
 * Handles midnight wrap for bedtime.
 */
function minutesPastLateEdge(actualMin: number, lateEdge: number): number {
  const delta = (actualMin - lateEdge + 1440) % 1440
  if (delta > 720) return 0 // actually earlier on the clock
  return delta
}

export default async function StandingHealthPage() {
  const [health, persisted] = await Promise.all([
    fetchLatestStanding(),
    loadStanding(),
  ])

  const rhythm = health?.rhythm
  const sleep = health?.sleep
  const signals = health?.signals

  let ladderTier: string | undefined = rhythm?.tier
  let ladderSummary: string | null = null
  let phaseName = 'Meet Yourself'
  let phaseNum = persisted.baseline_phase || 1
  let phaseLabel = ''
  let usedLadder = false
  let bedDevPhase: number | null = null
  let wakeDevPhase: number | null = null
  let ladderEffects = rhythm
    ? {
        rewardEfficiency: rhythm.rewardEfficiency,
        consistencyTokenMultiplier: rhythm.consistencyTokenMultiplier,
        shadowDebtDelta: rhythm.shadowDebtDelta,
        leaderTrustDelta: rhythm.leaderTrustDelta,
      }
    : null

  if (sleep?.bedtime && sleep?.wakeTime && health?.date) {
    const ladder = scoreNightWithLadder(
      persisted,
      {
        bedtimeIso: sleep.bedtime,
        wakeIso: sleep.wakeTime,
        totalSleepHours: sleep.totalHours ?? null,
        restingHeartRate: signals?.restingHeartRate ?? null,
        hrvMs: signals?.hrv ?? null,
        activeEnergyKcal: signals?.activeEnergyKcal ?? null,
      },
      health.date
    )
    if (ladder) {
      usedLadder = true
      ladderTier = ladder.tier
      ladderSummary = ladder.summary
      phaseName = ladder.phaseName
      phaseNum = ladder.phase
      phaseLabel = ladder.phaseLabel
      ladderEffects = {
        rewardEfficiency: ladder.effects.rewardEfficiency,
        consistencyTokenMultiplier: ladder.effects.tokenMultiplier,
        shadowDebtDelta: ladder.effects.shadowDebtDelta,
        leaderTrustDelta: ladder.effects.leaderTrustDelta,
      }

      const progress = progressFromStanding(persisted)
      const phase = getPhase(progress)
      const bedMin = chicagoMinutesFromMidnight(sleep.bedtime)
      const wakeMin = chicagoMinutesFromMidnight(sleep.wakeTime)
      if (bedMin != null && phase.windows.bedtime) {
        bedDevPhase = minutesPastLateEdge(bedMin, phase.windows.bedtime.max)
      }
      if (wakeMin != null && phase.windows.wake) {
        wakeDevPhase = minutesPastLateEdge(wakeMin, phase.windows.wake.max)
      }
    }
  } else {
    const progress = progressFromStanding(persisted)
    const phase = getPhase(progress)
    phaseName = phase.name
    phaseNum = phase.phase
    const bedWindow = phase.windows.bedtime
    const wakeWindow = phase.windows.wake
    phaseLabel = [
      bedWindow ? `bed ${bedWindow.label}` : null,
      wakeWindow ? `wake ${wakeWindow.label}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const tier = tierStyle(ladderTier)
  const contribution = usedLadder
    ? ladderContribution(ladderTier)
    : (rhythm?.contribution ?? null)
  const bedDev = usedLadder ? bedDevPhase : (rhythm?.bedDeviationMinutes ?? null)
  const wakeDev = usedLadder ? wakeDevPhase : (rhythm?.wakeDeviationMinutes ?? null)

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

  const hasSleepStages =
    sleep && (sleep.deep != null || sleep.rem != null || sleep.core != null)

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-12 min-h-screen">
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors mb-3"
        >
          ← Home
        </Link>
        <p className="text-zinc-500 text-xs tracking-wide uppercase">Health & Consistency</p>
        <h1 className="text-2xl font-medium text-white tracking-tight">Standing</h1>
      </div>

      <StandingTabs active="health" />

      <div className="space-y-4">
        {/* Phase ladder */}
        <section className="rounded-2xl border border-violet-900/40 bg-violet-950/20 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-violet-400/80">
              Baseline phase
            </p>
            <p className="text-[11px] text-zinc-500 tabular-nums">
              streak {persisted.baseline_good_streak || 0}
            </p>
          </div>
          <p className="text-sm font-medium text-violet-100">
            Phase {phaseNum} · {phaseName}
          </p>
          {phaseLabel && (
            <p className="text-[11px] text-zinc-500 leading-relaxed">{phaseLabel}</p>
          )}
          {ladderSummary && (
            <p className="text-[11px] text-zinc-400 pt-0.5">{ladderSummary}</p>
          )}
        </section>

        {/* Rhythm + sleep */}
        {rhythm || ladderTier ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Rhythm</p>
                <p className={`text-2xl font-medium mt-0.5 ${tier.color}`}>{tier.label}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                  Contribution{usedLadder ? ' (phase)' : ''}
                </p>
                <p className="text-lg font-medium text-white tabular-nums">
                  {contribution != null && contribution > 0 ? '+' : ''}
                  {contribution ?? '—'}
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
                    <p className="text-[10px] text-zinc-500">
                      Bed vs phase{usedLadder ? ' late edge' : ''}
                    </p>
                    <p className="text-zinc-200 tabular-nums">{fmtDev(bedDev)}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">
                      Wake vs phase{usedLadder ? ' late edge' : ''}
                    </p>
                    <p className="text-zinc-200 tabular-nums">{fmtDev(wakeDev)}</p>
                  </div>
                </div>
              </div>
            )}

            {hasSleepStages && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                  Sleep stages
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-2 py-2">
                    <p className="text-[10px] text-zinc-500">Deep</p>
                    <p className="text-sm text-indigo-300 tabular-nums">
                      {fmtNum(sleep?.deep, 1, 'h')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-2 py-2">
                    <p className="text-[10px] text-zinc-500">REM</p>
                    <p className="text-sm text-violet-300 tabular-nums">
                      {fmtNum(sleep?.rem, 1, 'h')}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-2 py-2">
                    <p className="text-[10px] text-zinc-500">Core</p>
                    <p className="text-sm text-sky-300 tabular-nums">
                      {fmtNum(sleep?.core, 1, 'h')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {ladderEffects && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                  Rhythm effects (ladder)
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Reward efficiency</p>
                    <p className="text-zinc-200 tabular-nums">
                      {ladderEffects.rewardEfficiency.toFixed(2)}×
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Token multiplier</p>
                    <p className="text-zinc-200 tabular-nums">
                      {ladderEffects.consistencyTokenMultiplier.toFixed(2)}×
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Shadow debt Δ</p>
                    <p
                      className={`tabular-nums ${
                        ladderEffects.shadowDebtDelta > 0
                          ? 'text-amber-400'
                          : ladderEffects.shadowDebtDelta < 0
                            ? 'text-emerald-400'
                            : 'text-zinc-200'
                      }`}
                    >
                      {ladderEffects.shadowDebtDelta > 0 ? '+' : ''}
                      {ladderEffects.shadowDebtDelta}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2">
                    <p className="text-[10px] text-zinc-500">Leader trust Δ</p>
                    <p
                      className={`tabular-nums ${
                        ladderEffects.leaderTrustDelta > 0
                          ? 'text-emerald-400'
                          : ladderEffects.leaderTrustDelta < 0
                            ? 'text-red-400'
                            : 'text-zinc-200'
                      }`}
                    >
                      {ladderEffects.leaderTrustDelta > 0 ? '+' : ''}
                      {ladderEffects.leaderTrustDelta}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-5 py-6 text-center">
            <p className="text-zinc-500 text-sm">No rhythm data yet.</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Connect health export / MYTHIC_DATA_URL to score nights.
            </p>
          </section>
        )}

        {/* Body signals */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Body signals</p>
          {signals ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                <p className="text-[10px] text-zinc-500">Stress</p>
                <p className="text-sm font-medium text-zinc-200 capitalize">
                  {signals.stressProxy}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                <p className="text-[10px] text-zinc-500">Recovery</p>
                <p className="text-sm font-medium text-zinc-200 capitalize">
                  {signals.recoveryProxy}
                </p>
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
          ) : (
            <p className="text-xs text-zinc-600">No body signals for this window.</p>
          )}
        </section>

        {/* Self health */}
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
          <p className="text-[11px] text-zinc-600">
            Debt on books: {persisted.shadow_debt.toFixed(0)} · last tier:{' '}
            {persisted.last_rhythm_tier || '—'}
          </p>
        </section>

        <p className="text-center text-[11px] text-zinc-600 pt-1">
          {health?.date ? `Rhythm scored for ${health.date}` : 'Waiting on health sync'}
        </p>
      </div>
    </main>
  )
}
