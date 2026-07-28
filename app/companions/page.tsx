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
import {
  MythicEmptyState,
  MythicPage,
  MythicPageHeader,
  MythicPanel,
  MythicSeal,
  MythicSectionHeader,
} from '@/components/MythicSurface'
import { CompanionPresence } from '@/components/CompanionPresence'
import { deriveDualAxis, dualAxisLabel } from '@/lib/engines/relationship-wire'
import styles from './companions.module.css'

export const dynamic = 'force-dynamic'

type CompanionRow = {
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

function relationshipState(row: CompanionRow | undefined, slug: string): {
  stage: string
  mood: string
} {
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

export default async function CompanionsPage() {
  const supabase = await createClient()
  const [{ data: rows }, { data: skills }, player] = await Promise.all([
    supabase.from('companion').select('*'),
    supabase.from('player_skills').select('*'),
    loadPlayerState(),
  ])

  const companionRows = (rows || []) as CompanionRow[]
  const { party } = player
  const levelMap: Record<string, number> = {}
  for (const s of skills || []) {
    levelMap[s.skill] = s.level || skillLevelFromXp(s.xp || 0)
  }

  const unlockedSlugs = new Set(
    companionRows
      .filter((c) => c.is_unlocked !== false)
      .map((c) => c.slug || (c.name === 'Seraphine' ? 'seraphine' : ''))
      .filter(Boolean)
  )
  unlockedSlugs.add('seraphine')

  const rowsBySlug = new Map<string, CompanionRow>()
  for (const row of companionRows) {
    const slug = row.slug || (row.name === 'Seraphine' ? 'seraphine' : '')
    if (slug) rowsBySlug.set(slug, row)
  }

  const activePartySlugs = new Set(party.members.map((m) => m.slug))
  const leaderSlug = party.members.find((m) => m.isLeader)?.slug

  const roster = COMPANION_DEFS.filter((d) => d.starter || unlockedSlugs.has(d.slug))
  const locked = COMPANION_DEFS.filter((d) => !d.starter && !unlockedSlugs.has(d.slug))
  const openSlots = Math.max(0, MAX_PARTY_SIZE - party.members.length)

  return (
    <MythicPage>
      <MythicPageHeader
        eyebrow="The fellowship"
        title="Companions"
        subtitle="Not inventory. Not bonuses. The women who walk beside you remember how you live."
        aside={
          <MythicSeal label={`${party.members.length} of ${MAX_PARTY_SIZE} active`}>
            <p className={styles.headerSealValue}>
              {party.members.length}/{MAX_PARTY_SIZE}
            </p>
            <p className={styles.headerSealLabel}>Active</p>
          </MythicSeal>
        }
      />

      <div className={styles.stack}>
        <MythicPanel tone="violet" emphasis>
          <div className={styles.partyHeader}>
            <div>
              <p className={styles.panelEyebrow}>At your side</p>
              <h2 className={styles.panelTitle}>Active Party</h2>
              <p className={styles.panelSub}>
                {party.locked ? 'The formation is locked.' : 'Choose up to five. One may lead.'}
              </p>
            </div>
            <form action={actionTogglePartyLock}>
              <button type="submit" className={styles.lockButton}>
                {party.locked ? 'Unlock formation' : 'Lock formation'}
              </button>
            </form>
          </div>

          <div className={styles.partyGrid}>
            {party.members.map((member) => {
              const def = getCompanionDef(member.slug)
              if (!def) return null
              const row = rowsBySlug.get(member.slug)
              const state = relationshipState(row, member.slug)

              return (
                <div className={styles.partySlot} key={member.slug}>
                  <Link
                    href={`/companion-profile?c=${member.slug}`}
                    className={styles.partyLink}
                  >
                    <CompanionPresence
                      slug={member.slug}
                      name={def.name}
                      title={def.title}
                      imageUrl={row?.image_url}
                      emoji={def.emoji}
                      rarity={def.rarity}
                      stage={state.stage}
                      mood={state.mood}
                      variant="party"
                      leader={member.isLeader}
                    />
                  </Link>
                  <div className={styles.partyControls}>
                    {!member.isLeader ? (
                      <form action={actionSetLeader}>
                        <input type="hidden" name="slug" value={member.slug} />
                        <button
                          type="submit"
                          className={styles.smallButton}
                          disabled={party.locked}
                        >
                          Make leader
                        </button>
                      </form>
                    ) : (
                      <span className={styles.partyTag}>First voice</span>
                    )}
                    <form action={actionLeaveParty}>
                      <input type="hidden" name="slug" value={member.slug} />
                      <button
                        type="submit"
                        className={`${styles.smallButton} ${styles.dangerButton}`}
                        disabled={party.locked}
                      >
                        Release
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}

            {Array.from({ length: openSlots }).map((_, index) => (
              <div className={styles.emptySlot} key={`empty-${index}`}>
                <div>
                  <p className={styles.emptySlotMark}>◇</p>
                  <p className={styles.emptySlotText}>Open place</p>
                </div>
              </div>
            ))}
          </div>

          <p className={styles.partyNote}>
            Active companions receive Trust updates and dialogue priority. The full roster remains
            available; these are the women currently moving through the day with you.
          </p>
        </MythicPanel>

        <section>
          <MythicSectionHeader title="The Roster" hint={`${roster.length} awakened`} sigil="✦" />
          {roster.length === 0 ? (
            <MythicEmptyState
              title="The hall is quiet"
              body="New companions will appear as your skills and story deepen."
            />
          ) : (
            <div className={styles.rosterGrid}>
              {roster.map((companionDef) => {
                const row = rowsBySlug.get(companionDef.slug)
                const inParty = activePartySlugs.has(companionDef.slug)
                const canJoin = !inParty && party.members.length < MAX_PARTY_SIZE && !party.locked
                const state = relationshipState(row, companionDef.slug)

                return (
                  <article
                    className={`${styles.rosterCard} ${
                      inParty ? styles.rosterCardActive : ''
                    }`}
                    key={companionDef.slug}
                  >
                    <Link href={`/companion-profile?c=${companionDef.slug}`}>
                      <CompanionPresence
                        slug={companionDef.slug}
                        name={companionDef.name}
                        title={companionDef.title}
                        imageUrl={row?.image_url}
                        emoji={companionDef.emoji}
                        rarity={companionDef.rarity}
                        stage={state.stage}
                        mood={state.mood}
                        variant="roster"
                        leader={companionDef.slug === leaderSlug}
                      />
                    </Link>

                    <div className={styles.cardBody}>
                      <div className={styles.cardMeta}>
                        <p className={styles.raceClass}>
                          {companionDef.race} · {companionDef.className}
                        </p>
                        {inParty && <span className={styles.partyTag}>With you</span>}
                      </div>
                      <p className={styles.relationshipLine}>
                        <strong>{state.stage}</strong> · {state.mood}
                      </p>

                      <div className={styles.chips}>
                        {companionDef.affinities.slice(0, 2).map((affinity) => (
                          <span className={styles.chip} key={affinity}>
                            {SKILL_LABELS[affinity]}
                          </span>
                        ))}
                        {companionDef.traits.slice(0, 2).map((trait) => (
                          <span className={styles.chip} key={trait}>
                            {trait}
                          </span>
                        ))}
                      </div>

                      <div className={styles.cardActions}>
                        <div className={styles.actionLinks}>
                          <Link
                            href={`/companion-profile?c=${companionDef.slug}`}
                            className={styles.textLink}
                          >
                            Enter her space
                          </Link>
                          <Link
                            href={`/messages?c=${companionDef.slug}`}
                            className={`${styles.textLink} ${styles.textLinkMuted}`}
                          >
                            Write
                          </Link>
                        </div>

                        {inParty ? (
                          <span className={styles.statusText}>Active party</span>
                        ) : canJoin ? (
                          <form action={actionJoinParty}>
                            <input type="hidden" name="slug" value={companionDef.slug} />
                            <button type="submit" className={styles.primaryButton}>
                              Invite
                            </button>
                          </form>
                        ) : party.members.length >= MAX_PARTY_SIZE ? (
                          <span className={styles.statusText}>Formation full</span>
                        ) : party.locked ? (
                          <span className={styles.statusText}>Formation locked</span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <MythicSectionHeader title="Beyond the Veil" hint={`${locked.length} unknown`} sigil="◈" />
          {locked.length === 0 ? (
            <MythicEmptyState title="Every known path is open" />
          ) : (
            <div className={styles.lockedGrid}>
              {locked.map((companionDef) => {
                const ready = meetsUnlock(companionDef.unlock, levelMap)
                const requirement = Object.entries(companionDef.unlock)
                  .map(
                    ([key, value]) =>
                      `${SKILL_LABELS[key as keyof typeof SKILL_LABELS]} ${value}`
                  )
                  .join(' · ')

                return (
                  <article className={styles.lockedCard} key={companionDef.slug}>
                    <CompanionPresence
                      slug={companionDef.slug}
                      name={companionDef.name}
                      title={companionDef.title}
                      emoji={companionDef.emoji}
                      rarity={companionDef.rarity}
                      stage={ready ? 'The veil is thinning' : 'Unawakened'}
                      mood={ready ? 'Your growth has reached her world' : 'Her path has not crossed yours'}
                      variant="locked"
                      locked
                    />
                    <div className={styles.lockedBody}>
                      <div className={styles.lockedMeta}>
                        <p className={styles.lockedName}>{companionDef.race}</p>
                        <span className={ready ? styles.readyText : styles.statusText}>
                          {ready ? 'Requirements met' : companionDef.rarity}
                        </span>
                      </div>
                      <p className={styles.lockedRequirement}>
                        {ready
                          ? 'Complete a quest or open Today. She is close enough to answer.'
                          : `Requires ${requirement}`}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </MythicPage>
  )
}
