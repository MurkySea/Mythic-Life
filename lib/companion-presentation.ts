import { deriveDualAxis, dualAxisLabel } from './engines/relationship-wire'

export type CompanionDisplayRow = {
  id?: string
  slug?: string | null
  name?: string | null
  image_url?: string | null
  affinity_score?: number | null
  bond_xp?: number | null
  trust_score?: number | null
  intimacy_score?: number | null
  consecutive_bad_days?: number | null
  consecutive_good_days?: number | null
  is_unlocked?: boolean | null
}

export function companionRelationshipState(
  row: CompanionDisplayRow | undefined | null,
  slug: string
): { stage: string; mood: string } {
  if (!row) return { stage: 'New bond', mood: 'Waiting at the edge of the firelight' }

  const dual = deriveDualAxis({
    slug,
    affinity_score: Number(row.affinity_score) || 1,
    bond_xp: Number(row.bond_xp) || 0,
    trust_score: row.trust_score != null ? Number(row.trust_score) : null,
    intimacy_score: row.intimacy_score != null ? Number(row.intimacy_score) : null,
    consecutive_bad_days:
      row.consecutive_bad_days != null ? Number(row.consecutive_bad_days) : null,
    consecutive_good_days:
      row.consecutive_good_days != null ? Number(row.consecutive_good_days) : null,
  })

  const stage = dual.isInLove ? 'Devoted' : dualAxisLabel(dual.stage)
  const badDays = Number(row.consecutive_bad_days) || 0
  const goodDays = Number(row.consecutive_good_days) || 0

  if (badDays >= 3) return { stage, mood: 'Worried by the distance between you' }
  if (badDays > 0) return { stage, mood: 'Quietly concerned, still watching for you' }
  if (goodDays >= 3) return { stage, mood: 'Close, steady, and at ease beside you' }
  if (stage === 'Distant') return { stage, mood: 'Still learning the shape of your days' }
  if (stage === 'Intimate' || stage === 'Devoted') {
    return { stage, mood: 'Her guard is lower when you are near' }
  }
  return { stage, mood: 'Present and attentive' }
}
