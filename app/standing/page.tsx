import Link from 'next/link'
import { fetchLatestStanding, tierStyle } from '@/lib/standing'

export const dynamic = 'force-dynamic'

export default async function StandingPage() {
  const standing = await fetchLatestStanding()
  const rhythm = standing?.rhythm
  const sleep = standing?.sleep
  const signals = standing?.signals
  const tier = tierStyle(rhythm?.tier)

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-12 min-h-screen">
      {/* Header */}
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

      {!standing || !rhythm ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-5 py-10 text-center space-y-3">
          <p className="text-zinc-400 text-sm leading-relaxed">
            No rhythm data yet. Once Health Auto Export posts sleep to the data service, this page will light up.
          </p>
          <p className="text-[11px] text-zinc-600">
            Waiting on <code className="text-zinc-500">/api/latest</code>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Rhythm tier */}
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

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Reward efficiency</p>
                <p className="text-sm font-medium text-violet-300 tabular-nums">
                  {rhythm.rewardEfficiency.toFixed(2)}×
                </p>
              </div>
              <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Token multiplier</p>
                <p className="text-sm font-medium text-sky-300 tabular-nums">
                  {rhythm.consistencyTokenMultiplier.toFixed(2)}×
                </p>
              </div>
              <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Shadow Debt Δ</p>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    rhythm.shadowDebtDelta > 0
                      ? 'text-amber-400'
                      : rhythm.shadowDebtDelta < 0
                        ? 'text-emerald-400'
                        : 'text-zinc-300'
                  }`}
                >
                  {rhythm.shadowDebtDelta > 0 ? '+' : ''}
                  {rhythm.shadowDebtDelta}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Leader Trust Δ</p>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    rhythm.leaderTrustDelta > 0
                      ? 'text-emerald-400'
                      : rhythm.leaderTrustDelta < 0
                        ? 'text-red-400'
                        : 'text-zinc-300'
                  }`}
                >
                  {rhythm.leaderTrustDelta > 0 ? '+' : ''}
                  {rhythm.leaderTrustDelta}
                </p>
              </div>
            </div>
          </section>

          {/* Sleep window */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Sleep window</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-500">Bedtime</p>
                <p className="text-base font-medium text-white">
                  {sleep?.bedtimeDisplay || '—'}
                </p>
              </div>
              <span className="text-zinc-600">→</span>
              <div className="text-right">
                <p className="text-[10px] text-zinc-500">Wake</p>
                <p className="text-base font-medium text-white">
                  {sleep?.wakeDisplay || '—'}
                </p>
              </div>
            </div>
            {sleep?.totalHours != null && (
              <p className="text-xs text-zinc-500">
                {sleep.totalHours.toFixed(1)}h total
                {sleep.deep != null && ` · Deep ${Number(sleep.deep).toFixed(1)}h`}
                {sleep.rem != null && ` · REM ${Number(sleep.rem).toFixed(1)}h`}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p className="text-zinc-500">
                Bed deviation:{' '}
                <span className="text-zinc-300">
                  {rhythm.bedDeviationMinutes === 0
                    ? 'on target'
                    : `${rhythm.bedDeviationMinutes} min`}
                </span>
              </p>
              <p className="text-zinc-500 text-right">
                Wake deviation:{' '}
                <span className="text-zinc-300">
                  {rhythm.wakeDeviationMinutes === 0
                    ? 'on target'
                    : `${rhythm.wakeDeviationMinutes} min`}
                </span>
              </p>
            </div>
          </section>

          {/* Body signals */}
          {signals && (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Body signals</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-zinc-500">Stress proxy</p>
                  <p className="text-sm font-medium text-zinc-200 capitalize">
                    {signals.stressProxy}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">Recovery proxy</p>
                  <p className="text-sm font-medium text-zinc-200 capitalize">
                    {signals.recoveryProxy}
                  </p>
                </div>
                {signals.hrv != null && (
                  <div>
                    <p className="text-[10px] text-zinc-500">HRV</p>
                    <p className="text-sm font-medium text-zinc-200 tabular-nums">{signals.hrv}</p>
                  </div>
                )}
                {signals.restingHeartRate != null && (
                  <div>
                    <p className="text-[10px] text-zinc-500">Resting HR</p>
                    <p className="text-sm font-medium text-zinc-200 tabular-nums">
                      {signals.restingHeartRate}
                    </p>
                  </div>
                )}
                {signals.steps != null && (
                  <div>
                    <p className="text-[10px] text-zinc-500">Steps</p>
                    <p className="text-sm font-medium text-zinc-200 tabular-nums">
                      {Math.round(signals.steps).toLocaleString()}
                    </p>
                  </div>
                )}
                {signals.activeEnergyKcal != null && (
                  <div>
                    <p className="text-[10px] text-zinc-500">Active energy</p>
                    <p className="text-sm font-medium text-zinc-200 tabular-nums">
                      {Math.round(signals.activeEnergyKcal)} kcal
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Date + message */}
          <p className="text-center text-[11px] text-zinc-600 pt-1">
            {standing.date ? `Scored for ${standing.date}` : 'Latest export'}
            {standing.message ? ` · ${standing.message}` : ''}
          </p>
        </div>
      )}
    </main>
  )
}
