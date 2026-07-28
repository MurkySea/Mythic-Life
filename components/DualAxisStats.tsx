/**
 * Trust / Intimacy dual-axis surface for companion profiles.
 * Prefers stored trust_score / intimacy_score via deriveDualAxis.
 */
import {
  deriveDualAxis,
  dualAxisLabel,
  type LiveCompanionScores,
} from '@/lib/engines/relationship-wire'

type Props = {
  companion: {
    slug?: string | null
    name?: string | null
    affinity_score?: number | null
    bond_xp?: number | null
    trust_score?: number | null
    intimacy_score?: number | null
    consecutive_bad_days?: number | null
    consecutive_good_days?: number | null
  }
  fallbackSlug: string
}

function AxisBar({ value, tone }: { value: number; tone: 'trust' | 'intimacy' }) {
  const pct = Math.max(0, Math.min(100, value))
  const fill =
    tone === 'trust'
      ? 'bg-sky-500'
      : 'bg-fuchsia-500'
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full ${fill} transition-[width] duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function DualAxisStats({ companion, fallbackSlug }: Props) {
  const slug =
    companion.slug ||
    (companion.name === 'Seraphine' ? 'seraphine' : fallbackSlug)

  const scores: LiveCompanionScores = {
    slug,
    affinity_score: Number(companion.affinity_score) || 1,
    bond_xp: Number(companion.bond_xp) || 0,
    trust_score:
      companion.trust_score != null ? Number(companion.trust_score) : null,
    intimacy_score:
      companion.intimacy_score != null ? Number(companion.intimacy_score) : null,
    consecutive_bad_days:
      companion.consecutive_bad_days != null
        ? Number(companion.consecutive_bad_days)
        : null,
    consecutive_good_days:
      companion.consecutive_good_days != null
        ? Number(companion.consecutive_good_days)
        : null,
  }

  const dual = deriveDualAxis(scores)
  const stageLabel = dual.isInLove ? 'Devoted ♥' : dualAxisLabel(dual.stage)
  const trust = dual.trust.value
  const intimacy = dual.intimacy.value

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <span className="text-[11px] px-3 py-1 rounded-full border border-violet-700/50 bg-violet-950/40 text-violet-200 tracking-wide">
          {stageLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-950/70 rounded-2xl p-4 border border-sky-900/40">
          <p className="text-[11px] text-sky-400/80 uppercase tracking-wider">Trust</p>
          <p className="text-3xl font-medium text-sky-300 mt-1 tabular-nums">
            {Math.round(trust)}
          </p>
          <AxisBar value={trust} tone="trust" />
        </div>
        <div className="bg-zinc-950/70 rounded-2xl p-4 border border-fuchsia-900/40">
          <p className="text-[11px] text-fuchsia-400/80 uppercase tracking-wider">Intimacy</p>
          <p className="text-3xl font-medium text-fuchsia-300 mt-1 tabular-nums">
            {Math.round(intimacy)}
          </p>
          <AxisBar value={intimacy} tone="intimacy" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-950/40 rounded-xl px-3 py-2.5 text-center border border-zinc-800/40">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Affinity</p>
          <p className="text-lg font-medium text-zinc-300 mt-0.5 tabular-nums">
            {companion.affinity_score ?? 1}
          </p>
        </div>
        <div className="bg-zinc-950/40 rounded-xl px-3 py-2.5 text-center border border-zinc-800/40">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Bond XP</p>
          <p className="text-lg font-medium text-zinc-300 mt-0.5 tabular-nums">
            {companion.bond_xp || 0}
          </p>
        </div>
      </div>

      {(scores.consecutive_bad_days || 0) > 0 && (
        <p className="text-[10px] text-amber-400/80 text-center">
          {scores.consecutive_bad_days} rough night
          {scores.consecutive_bad_days === 1 ? '' : 's'} in a row — she may check in
        </p>
      )}
    </div>
  )
}

/** Compact stage line for party grid cards */
export function DualAxisStageLine({
  companion,
  fallbackSlug,
}: Props) {
  const slug =
    companion.slug ||
    (companion.name === 'Seraphine' ? 'seraphine' : fallbackSlug)

  const dual = deriveDualAxis({
    slug,
    affinity_score: Number(companion.affinity_score) || 1,
    bond_xp: Number(companion.bond_xp) || 0,
    trust_score:
      companion.trust_score != null ? Number(companion.trust_score) : null,
    intimacy_score:
      companion.intimacy_score != null ? Number(companion.intimacy_score) : null,
  })

  const label = dual.isInLove ? 'Devoted ♥' : dualAxisLabel(dual.stage)
  return (
    <p className="text-[10px] text-violet-400/80 mt-0.5">
      {label}
      <span className="text-zinc-600"> · Aff {companion.affinity_score || 1}</span>
    </p>
  )
}
