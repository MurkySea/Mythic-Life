import type { CSSProperties } from 'react'
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
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import { companionTone } from '@/lib/companion-tone'
import { StandingTabs } from './StandingTabs'
import styles from './standing.module.css'

export const dynamic = 'force-dynamic'

const DOMAIN_LABELS: Record<LifeDomain, string> = {
  self: 'Self',
  relationship: 'Relationship',
  stewardship: 'Stewardship',
  domain: 'Calling',
  legacy: 'Legacy',
}

const DOMAIN_ICONS: Record<LifeDomain, MythicIconName> = {
  self: 'profile',
  relationship: 'relationship',
  stewardship: 'currency',
  domain: 'quest',
  legacy: 'achievement',
}

const DOMAIN_ORDER: LifeDomain[] = ['self', 'relationship', 'stewardship', 'domain', 'legacy']

function moodFromAffinity(affinity: number): string {
  if (affinity >= 16) return 'devoted'
  if (affinity >= 10) return 'steady'
  if (affinity >= 5) return 'concerned'
  if (affinity >= 2) return 'disappointed'
  return 'withdrawn'
}

function shadowState(debt: number): string {
  if (debt <= 0) return 'Clear'
  if (debt < 8) return 'Whispering'
  if (debt < 20) return 'Gathering'
  if (debt < 40) return 'Pressing'
  return 'Encroaching'
}

function readable(value: unknown): string {
  const text = String(value ?? '').replace(/[_-]+/g, ' ').trim()
  if (!text) return 'None'
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase())
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
  for (const task of recentTasks || []) {
    tags.push(...parseDomains(task.domains, task.domain))
    if (task.title) titles.push(task.title)
  }

  const aggregates = aggregateDomains(tags, { titles })
  const neglect = detectSelfNeglect(aggregates)
  const maxDomain = Math.max(1, ...Object.values(aggregates))

  const { data: companions } = await supabase
    .from('companion')
    .select('id, name, slug, affinity_score, is_unlocked')
    .or('is_unlocked.eq.true,is_unlocked.is.null')
    .order('affinity_score', { ascending: false })

  const party = (companions || []).map((companion) => {
    const slug =
      companion.slug ||
      (companion.name === 'Seraphine'
        ? 'seraphine'
        : companion.name?.toLowerCase().replace(/\s+/g, '_') || '')
    const affinity = companion.affinity_score || 1
    const def = getCompanionDef(slug)
    return {
      slug,
      name: companion.name || slug,
      title: def?.title || 'Companion',
      affinity,
      mood: moodFromAffinity(affinity),
      tone: companionTone(slug),
    }
  })

  const debtForMultiplier = Math.max(0, persisted.shadow_debt || 0)
  const rhythmMultiplier = rhythm?.rewardEfficiency ?? 1
  const debtMultiplier = debtToMultiplier(debtForMultiplier)
  const selfMultiplier = neglect.selfMultiplier
  const combined = Math.max(
    0.55,
    Number((rhythmMultiplier * debtMultiplier * selfMultiplier).toFixed(3))
  )
  const efficiencyPercent = Math.max(0, Math.min(100, Math.round(combined * 100)))

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

  const integrityPercent = integrity
    ? Math.max(0, Math.min(100, Number(integrity.value) || 0))
    : 0

  return (
    <main className={styles.page}>
      <div className={styles.ambientGold} aria-hidden />
      <div className={styles.ambientCrimson} aria-hidden />
      <div className={styles.ambientBlue} aria-hidden />
      <div className={styles.stars} aria-hidden />

      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <span className={styles.backGlyph} aria-hidden>‹</span>
          Return to command
        </Link>
        <p className={styles.eyebrow}>Soul & consequence</p>
        <h1 className={styles.title}>The Soul Ledger</h1>
        <p className={styles.subtitle}>
          A true account of the forces shaping your strength, your world, and those who walk beside you.
        </p>
      </header>

      <StandingTabs active="standing" />

      <div className={styles.stack}>
        <section className={styles.hero} aria-labelledby="chronicle-heading">
          <div className={styles.heroTop}>
            <div>
              <p className={styles.sectionEyebrow}>Today&apos;s chronicle</p>
              <h2 id="chronicle-heading" className={styles.headline}>{headline}</h2>
              <p className={styles.chronicle}>{chronicle}</p>
            </div>
            {integrity && (
              <div
                className={styles.integritySeal}
                style={{ '--integrity': `${integrityPercent}%` } as CSSProperties}
                aria-label={`World integrity ${integrity.value}, ${BAND_LABEL[integrity.band]}`}
              >
                <div className={styles.integrityInner}>
                  <p className={styles.integrityValue}>{integrity.value}</p>
                  <p className={styles.integrityLabel}>{BAND_LABEL[integrity.band]}</p>
                </div>
              </div>
            )}
          </div>
          {integrity && <p className={styles.heroHint}>{BAND_HINT[integrity.band]}</p>}
        </section>

        <section className={styles.resources} aria-label="Accumulated resources">
          <div className={styles.resource}>
            <span className={styles.resourceIcon} aria-hidden><MythicIcon name="spark" size={15} /></span>
            <p className={styles.resourceValue}>{Math.round(persisted.total_xp)}</p>
            <p className={styles.resourceLabel}>Experience</p>
          </div>
          <div className={styles.resource}>
            <span className={styles.resourceIcon} aria-hidden><MythicIcon name="currency" size={15} /></span>
            <p className={styles.resourceValue}>{Math.round(persisted.total_gold)}</p>
            <p className={styles.resourceLabel}>Gold</p>
          </div>
          <div className={styles.resource}>
            <span className={styles.resourceIcon} aria-hidden><MythicIcon name="rewards" size={15} /></span>
            <p className={styles.resourceValue}>{persisted.consistency_tokens.toFixed(1)}</p>
            <p className={styles.resourceLabel}>Tokens</p>
          </div>
          <div className={styles.resource}>
            <span className={styles.resourceIcon} aria-hidden><MythicIcon name="standing" size={15} /></span>
            <p className={styles.resourceValue}>{persisted.shadow_debt.toFixed(0)}</p>
            <p className={styles.resourceLabel}>Shadow Debt</p>
          </div>
        </section>

        <section className={styles.condition}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Current condition</p>
              <h2 className={styles.sectionTitle}>Strength available to the day</h2>
            </div>
            <p className={styles.sectionHint}>Rhythm, debt, and self-care combine into one lived result.</p>
          </div>

          <div className={styles.conditionGrid}>
            <div className={styles.multiplierBlock}>
              <p className={styles.multiplierValue}>{combined}×</p>
              <p className={styles.multiplierLabel}>Overall reward and effort efficiency</p>
              <div className={styles.efficiencyTrack} aria-label={`${efficiencyPercent}% efficiency`}>
                <div className={styles.efficiencyFill} style={{ width: `${efficiencyPercent}%` }} />
              </div>
              <p className={styles.rhythmLine}>
                Rhythm <strong>{tier.label}</strong>
                {health?.sleep?.totalHours != null && ` · ${health.sleep.totalHours.toFixed(1)}h sleep`}
                {' · '}
                <Link href="/standing/health" className={styles.rhythmLink}>read vital signs</Link>
              </p>
            </div>

            <div className={styles.forceList} aria-label="Efficiency forces">
              <div className={styles.force}>
                <p className={styles.forceLabel}>Rhythm</p>
                <p className={styles.forceValue}>{rhythmMultiplier.toFixed(2)}×</p>
              </div>
              <div className={styles.force}>
                <p className={styles.forceLabel}>Debt</p>
                <p className={styles.forceValue}>{debtMultiplier.toFixed(2)}×</p>
              </div>
              <div className={styles.force}>
                <p className={styles.forceLabel}>Self</p>
                <p className={styles.forceValue}>{selfMultiplier.toFixed(2)}×</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.domains}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Balance of the soul</p>
              <h2 className={styles.sectionTitle}>Where your recent effort has gone</h2>
            </div>
            <p className={styles.sectionHint}>A three-day reading of completed work.</p>
          </div>

          <div className={styles.domainList}>
            {DOMAIN_ORDER.map((domain) => {
              const score = aggregates[domain] || 0
              const percent = Math.min(100, (score / maxDomain) * 100)
              return (
                <div key={domain} className={styles.domainRow}>
                  <span className={styles.domainIcon} aria-hidden>
                    <MythicIcon name={DOMAIN_ICONS[domain]} size={16} />
                  </span>
                  <div>
                    <p className={styles.domainName}>{DOMAIN_LABELS[domain]}</p>
                    <div className={styles.domainTrack}>
                      <div className={styles.domainFill} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <span className={styles.domainScore}>{score.toFixed(0)}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className={styles.shadow}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Shadow pressure</p>
              <h2 className={styles.sectionTitle}>What is narrowing your strength</h2>
            </div>
            <p className={styles.sectionHint}>Not condemnation. Consequence made visible.</p>
          </div>
          <div className={styles.shadowGrid}>
            <div className={styles.shadowStat}>
              <p className={styles.shadowValue}>{shadowState(persisted.shadow_debt)}</p>
              <p className={styles.shadowLabel}>Debt state</p>
            </div>
            <div className={styles.shadowStat}>
              <p className={styles.shadowValue}>{readable(neglect.severity)}</p>
              <p className={styles.shadowLabel}>Self neglect</p>
            </div>
            <div className={styles.shadowStat}>
              <p className={styles.shadowValue}>{readable(partyMoodSnap?.mood || 'steady')}</p>
              <p className={styles.shadowLabel}>Party mood</p>
            </div>
          </div>
          <p className={styles.shadowCopy}>
            Shadow Debt weakens returns gradually. Care for the body and return to neglected obligations to restore room to move.
          </p>
        </section>

        <section className={styles.treasury}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Treasury of consistency</p>
              <h2 className={styles.sectionTitle}>Spend proof of return</h2>
            </div>
            <p className={styles.sectionHint}>Optional rewards. Never required for core play.</p>
          </div>
          <div className={styles.sinkList}>
            {TOKEN_SINKS.map((sink) => {
              const canAfford = persisted.consistency_tokens >= sink.cost
              return (
                <form key={sink.id} action={buySink} className={styles.sink}>
                  <input type="hidden" name="sink_id" value={sink.id} />
                  <div>
                    <p className={styles.sinkName}>{sink.label}</p>
                    <p className={styles.sinkCopy}>{sink.blurb}</p>
                  </div>
                  <button type="submit" disabled={!canAfford} className={styles.sinkButton}>
                    {sink.cost} tokens
                  </button>
                </form>
              )
            })}
          </div>
        </section>

        {party.length > 0 && (
          <section className={styles.party}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Those who follow you</p>
                <h2 className={styles.sectionTitle}>The party reads your life too</h2>
              </div>
              <p className={styles.sectionHint}>Trust responds to the pattern, not one perfect day.</p>
            </div>
            <div className={styles.partyList}>
              {party.slice(0, 6).map((companion) => (
                <div key={companion.slug} className={styles.partyRow}>
                  <span className={styles.partySigil} data-tone={companion.tone} aria-hidden>
                    {companion.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className={styles.partyName}>{companion.name}</p>
                    <p className={styles.partyTitle}>{companion.title}</p>
                  </div>
                  <div>
                    <p className={styles.partyMood}>{companion.mood}</p>
                    <p className={styles.partyAffinity}>Affinity {companion.affinity}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className={styles.footer}>
          {health?.date ? `Ledger sealed for ${health.date}` : 'Domain balance drawn from the last three days'}
        </p>
      </div>
    </main>
  )
}
