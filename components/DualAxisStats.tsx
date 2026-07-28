/**
 * Trust / Intimacy dual-axis surface for companion profiles.
 * Prefers stored trust_score / intimacy_score via deriveDualAxis.
 */
import {
  deriveDualAxis,
  dualAxisLabel,
  type LiveCompanionScores,
} from '@/lib/engines/relationship-wire'

type CompanionScoreInput = {
  slug?: string | null
  name?: string | null
  affinity_score?: number | null
  bond_xp?: number | null
  trust_score?: number | null
  intimacy_score?: number | null
  consecutive_bad_days?: number | null
  consecutive_good_days?: number | null
}

type Props = {
  companion: CompanionScoreInput
  fallbackSlug: string
}

function optionalNumber(value: number | null | undefined): number | null {
  return value == null ? null : Number(value)
}

function toLiveScores(
  companion: CompanionScoreInput,
  fallbackSlug: string
): LiveCompanionScores {
  return {
    slug:
      companion.slug ||
      (companion.name === 'Seraphine' ? 'seraphine' : fallbackSlug),
    affinity_score: Number(companion.affinity_score) || 1,
    bond_xp: Number(companion.bond_xp) || 0,
    trust_score: optionalNumber(companion.trust_score),
    intimacy_score: optionalNumber(companion.intimacy_score),
    consecutive_bad_days: optionalNumber(companion.consecutive_bad_days),
    consecutive_good_days: optionalNumber(companion.consecutive_good_days),
  }
}

function relationshipStageLabel(dual: ReturnType<typeof deriveDualAxis>): string {
  return dual.isInLove ? 'Devoted ♥' : dualAxisLabel(dual.stage)
}

function AxisBar({
  value,
  tone,
  label,
}: {
  value: number
  tone: 'trust' | 'intimacy'
  label: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  const fill = tone === 'trust' ? 'bg-sky-400' : 'bg-fuchsia-400'

  return (
    <div
      className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800/90 ring-1 ring-white/[0.03]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className={`h-full rounded-full ${fill} shadow-[0_0_12px_currentColor] transition-[width] duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function AxisCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'trust' | 'intimacy'
}) {
  const styles =
    tone === 'trust'
      ? {
          border: 'border-sky-900/50',
          glow: 'from-sky-500/[0.08]',
          label: 'text-sky-300/80',
          value: 'text-sky-200',
        }
      : {
          border: 'border-fuchsia-900/50',
          glow: 'from-fuchsia-500/[0.08]',
          label: 'text-fuchsia-300/80',
          value: 'text-fuchsia-200',
        }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${styles.border} bg-zinc-950/75 p-4 shadow-sm`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b ${styles.glow} to-transparent`}
      />
      <div className="relative">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-[11px] uppercase tracking-[0.14em] ${styles.label}`}>
            {label}
          </p>
          <span className="text-[10px] tabular-nums text-zinc-600">/ 100</span>
        </div>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${styles.value}`}>
          {Math.round(value)}
        </p>
        <AxisBar value={value} tone={tone} label={`${label} score`} />
      </div>
    </div>
  )
}

export default function DualAxisStats({ companion, fallbackSlug }: Props) {
  const scores = toLiveScores(companion, fallbackSlug)
  const dual = deriveDualAxis(scores)
  const stageLabel = relationshipStageLabel(dual)
  const trust = dual.trust.value
  const intimacy = dual.intimacy.value

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <span className="rounded-full border border-violet-600/50 bg-violet-950/55 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-violet-100 shadow-[0_0_20px_rgba(139,92,246,0.12)]">
          {stageLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AxisCard label="Trust" value={trust} tone="trust" />
        <AxisCard label="Intimacy" value={intimacy} tone="intimacy" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/45 px-3 py-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Affinity</p>
          <p className="mt-0.5 text-lg font-medium tabular-nums text-zinc-300">
            {companion.affinity_score ?? 1}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/45 px-3 py-2.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Bond XP</p>
          <p className="mt-0.5 text-lg font-medium tabular-nums text-zinc-300">
            {companion.bond_xp || 0}
          </p>
        </div>
      </div>

      {(scores.consecutive_bad_days || 0) > 0 && (
        <p className="rounded-lg border border-amber-900/30 bg-amber-950/15 px-3 py-2 text-center text-[10px] leading-relaxed text-amber-300/80">
          {scores.consecutive_bad_days} rough night
          {scores.consecutive_bad_days === 1 ? '' : 's'} in a row — she may check in
        </p>
      )}
    </div>
  )
}

/** Compact stage line for party grid cards */
export function DualAxisStageLine({ companion, fallbackSlug }: Props) {
  const dual = deriveDualAxis(toLiveScores(companion, fallbackSlug))
  const label = relationshipStageLabel(dual)

  return (
    <p className="mt-0.5 text-[10px] text-violet-300/80">
      {label}
      <span className="text-zinc-600"> · Aff {companion.affinity_score || 1}</span>
    </p>
  )
}
