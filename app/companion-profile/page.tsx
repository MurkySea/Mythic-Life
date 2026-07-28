import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCompanionDef } from '@/lib/companions'
import { SKILL_LABELS } from '@/lib/skills'
import {
  buildScenePrompt,
  scenesEarned,
  nextSceneMilestone,
  SCENE_MILESTONES,
} from '@/lib/scenes'
import { loadStanding } from '@/lib/engines/standing-store'
import { takeCompanionOnDate } from '@/app/date-actions'
import TakeOnDateButton from '@/components/TakeOnDateButton'
import DualAxisStats from '@/components/DualAxisStats'
import { persistGeneratedImage } from '@/lib/persistImage'
import { insertGalleryImage, isAffinitySceneRow } from '@/lib/galleryKind'
import { loadVisualMemoryHints } from '@/lib/memory-visual'
import { recordSceneMemory } from '@/lib/memory'
import {
  MythicEmptyState,
  MythicPage,
  MythicPageHeader,
  MythicPanel,
  MythicSectionHeader,
} from '@/components/MythicSurface'
import { CompanionPresence } from '@/components/CompanionPresence'
import {
  companionRelationshipState,
  type CompanionDisplayRow,
} from '@/lib/companion-presentation'
import styles from './profile.module.css'

export const dynamic = 'force-dynamic'

type ProfileCompanionRow = CompanionDisplayRow & {
  title?: string | null
  personality?: string | null
  personality_long?: string | null
}

async function generateCompanionImage(formData: FormData) {
  'use server'

  const slug = (formData.get('slug') as string) || 'seraphine'
  const supabase = await createClient()
  const def = getCompanionDef(slug)

  const { data: companion } = await supabase
    .from('companion')
    .select('id, affinity_score, name, slug, image_url')
    .or(`slug.eq.${slug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  if (!companion) {
    redirect(`/companion-profile?c=${slug}&scene=error`)
  }

  const affinity = companion.affinity_score || 1
  const characterName = companion.name || def?.name || 'Seraphine'
  const earned = scenesEarned(affinity)

  const { data: galleryRows } = await supabase
    .from('gallery_images')
    .select('kind, prompt_used')
    .eq('character_name', characterName)

  const used = (galleryRows || []).filter(isAffinitySceneRow).length

  if (used >= earned) {
    redirect(`/companion-profile?c=${slug}&scene=limit`)
  }

  const sceneIndex = used
  let prompt = buildScenePrompt(affinity, def, sceneIndex)

  try {
    const visual = await loadVisualMemoryHints(slug)
    if (visual.lines.length > 0) {
      prompt += `. Shared history flavor (subtle, do not override the scene): ${visual.lines.join('; ')}`
    }
  } catch {
    /* non-fatal */
  }

  try {
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt,
        n: 1,
      }),
    })

    const data = await response.json()
    let imageUrl = (data.data?.[0]?.url as string | undefined) ?? null

    if (!response.ok || !imageUrl) {
      const msg = (data?.error?.message || data?.message || '').toString().toLowerCase()
      const blocked =
        msg.includes('safety') ||
        msg.includes('policy') ||
        msg.includes('blocked') ||
        msg.includes('refus') ||
        response.status === 400
      redirect(`/companion-profile?c=${slug}&scene=${blocked ? 'blocked' : 'error'}`)
    }

    imageUrl = await persistGeneratedImage(imageUrl, {
      characterName,
      kind: `scene_${sceneIndex + 1}`,
    })

    await insertGalleryImage(supabase, {
      character_name: characterName,
      image_url: imageUrl,
      affinity_at_generation: affinity,
      prompt_used: prompt,
      kind: 'scene',
    })

    try {
      await recordSceneMemory(slug, sceneIndex + 1)
    } catch {
      /* non-fatal */
    }

    revalidatePath('/companion-profile')
    revalidatePath('/companions')
    revalidatePath('/gallery')
    redirect(`/companion-profile?c=${slug}&scene=ok`)
  } catch (error) {
    console.error('Image generation error:', error)
    redirect(`/companion-profile?c=${slug}&scene=error`)
  }
}

function SceneBanner({ status }: { status?: string }) {
  if (!status) return null
  const map: Record<string, { text: string; tone: string }> = {
    ok: {
      text: 'A new shared scene has been preserved in her gallery.',
      tone: styles.noticeSuccess,
    },
    limit: {
      text: 'No new scene is available yet. Deepen the bond to reach the next milestone.',
      tone: styles.noticeGold,
    },
    blocked: {
      text: 'The image model declined this scene. Nothing in the relationship state was changed.',
      tone: styles.noticeDanger,
    },
    error: {
      text: 'The scene could not be created. Check the image connection and try again.',
      tone: '',
    },
  }
  const item = map[status]
  if (!item) return null
  return <div className={`${styles.notice} ${item.tone}`}>{item.text}</div>
}

function DateBanner({ status }: { status?: string }) {
  if (!status) return null
  const map: Record<string, { text: string; tone: string }> = {
    ok: {
      text: 'The night has been saved. Its message and image now belong to your shared history.',
      tone: styles.noticeGold,
    },
    broke: {
      text: 'You do not have enough gold or date coins. Muster and complete quests first.',
      tone: '',
    },
    blocked: {
      text: 'The image model declined the date scene. No resources should be treated as a relationship change.',
      tone: styles.noticeDanger,
    },
    error: {
      text: 'The date could not begin. Try again in a moment.',
      tone: '',
    },
  }
  const item = map[status]
  if (!item) return null
  return <div className={`${styles.notice} ${item.tone}`}>{item.text}</div>
}

export default async function CompanionProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; scene?: string; date?: string }>
}) {
  const params = await searchParams
  const slug = params.c || ''
  const sceneStatus = params.scene
  const dateStatus = params.date

  const supabase = await createClient()
  const { data: all } = await supabase
    .from('companion')
    .select('*')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const party = (all || []) as ProfileCompanionRow[]

  if (!slug) {
    return (
      <MythicPage>
        <MythicPageHeader
          eyebrow="The fellowship"
          title="Companion Profiles"
          subtitle="Choose whose space to enter. Each relationship keeps its own history."
          aside={
            <Link href="/companions" className={styles.rosterLink}>
              Full roster
            </Link>
          }
        />

        {party.length > 0 ? (
          <div className={styles.profileGrid}>
            {party.map((companion) => {
              const companionSlug =
                companion.slug || (companion.name === 'Seraphine' ? 'seraphine' : '')
              const def = getCompanionDef(companionSlug)
              const state = companionRelationshipState(companion, companionSlug)
              const name = companion.name || def?.name || 'Companion'

              return (
                <Link
                  key={companion.id || companionSlug}
                  href={`/companion-profile?c=${companionSlug}`}
                  className={styles.profileCard}
                >
                  <CompanionPresence
                    slug={companionSlug}
                    name={name}
                    title={companion.title || def?.title}
                    imageUrl={companion.image_url}
                    emoji={def?.emoji}
                    rarity={def?.rarity}
                    stage={state.stage}
                    mood={state.mood}
                    variant="profile-card"
                  />
                </Link>
              )
            })}
          </div>
        ) : (
          <MythicEmptyState
            title="No one has entered the hall yet"
            body="Awaken a companion through skill growth and completed quests."
          />
        )}
      </MythicPage>
    )
  }

  const def = getCompanionDef(slug)
  const companion =
    party.find((row) => row.slug === slug || row.name === def?.name) ||
    party.find((row) => row.name === 'Seraphine')

  const characterName = companion?.name || def?.name || 'Seraphine'
  const affinity = companion?.affinity_score || 1
  const earned = scenesEarned(affinity)
  const nextAt = nextSceneMilestone(affinity)

  const [{ data: memories }, { data: galleryRows }, standing] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .eq('role', 'companion')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('gallery_images')
      .select('kind, prompt_used')
      .eq('character_name', characterName),
    loadStanding(),
  ])

  const filteredMemories = (memories || [])
    .filter((memory: { companion_slug?: string }) => {
      if (slug === 'seraphine') {
        return !memory.companion_slug || memory.companion_slug === 'seraphine'
      }
      return memory.companion_slug === slug
    })
    .slice(0, 8)

  const used = (galleryRows || []).filter(isAffinitySceneRow).length
  const canGenerate = used < earned
  const state = companionRelationshipState(companion, slug)

  return (
    <MythicPage>
      <MythicPageHeader
        eyebrow="Companion"
        title={characterName}
        subtitle={companion?.title || def?.title || 'A presence beside you'}
        backHref="/companion-profile"
        backLabel="Profiles"
        aside={
          <Link href={`/messages?c=${slug}`} className={styles.headerAction}>
            Write to her
          </Link>
        }
      />

      <SceneBanner status={sceneStatus} />
      <DateBanner status={dateStatus} />

      {companion ? (
        <div className={styles.contentStack}>
          <section className={styles.heroWrap}>
            <CompanionPresence
              slug={slug}
              name={characterName}
              title={companion.title || def?.title}
              imageUrl={companion.image_url}
              emoji={def?.emoji}
              rarity={def?.rarity}
              stage={state.stage}
              mood={state.mood}
              variant="hero"
            />

            <div className={styles.heroActions}>
              <Link href={`/messages?c=${slug}`} className={styles.actionPrimary}>
                Enter correspondence
              </Link>
              <Link
                href={`/gallery?character=${encodeURIComponent(characterName)}`}
                className={styles.actionSecondary}
              >
                Shared gallery
              </Link>
            </div>

            <p className={styles.presenceStatement}>{def?.regard || state.mood}</p>
          </section>

          <MythicPanel tone="violet" emphasis>
            <div className={styles.relationshipIntro}>
              <div>
                <p className={styles.panelKicker}>The bond between you</p>
                <h2 className={styles.panelTitle}>Trust and Intimacy</h2>
              </div>
              <div className={styles.stageSeal}>{state.stage}</div>
            </div>
            <DualAxisStats companion={companion} fallbackSlug={slug} />
          </MythicPanel>

          <MythicPanel tone="gold">
            <div className={styles.storyGrid}>
              <div className={styles.storyBlock}>
                <p className={styles.panelKicker}>Who she is</p>
                <h2 className={styles.panelTitle}>{def?.title || characterName}</h2>
                <p className={styles.storyText}>
                  {companion.personality_long || companion.personality || def?.personality}
                </p>

                {def && (
                  <div className={styles.chips}>
                    {def.affinities.map((affinityKey) => (
                      <span className={styles.chip} key={affinityKey}>
                        {SKILL_LABELS[affinityKey]}
                      </span>
                    ))}
                    {def.traits.slice(0, 3).map((trait) => (
                      <span className={styles.chip} key={trait}>
                        {trait}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.storyBlock}>
                <p className={styles.worldLabel}>Her world</p>
                <p className={styles.worldText}>
                  {def?.world || 'A road in Valdris that now intersects your own.'}
                </p>
                {def && <p className={styles.panelCopy}>{def.backstory}</p>}
              </div>
            </div>
          </MythicPanel>

          <section>
            <MythicSectionHeader
              title="Shared Experiences"
              hint={`${used} scene${used === 1 ? '' : 's'} preserved`}
              sigil="✧"
            />
            <div className={styles.experienceGrid}>
              <div className={styles.experienceCard}>
                <p className={styles.panelKicker}>Affinity scenes</p>
                <p className={styles.experienceValue}>
                  {used} <span>/ {earned} earned</span>
                </p>
                <p className={styles.panelCopy}>
                  {canGenerate
                    ? 'A new moment is available to claim.'
                    : nextAt
                      ? `The next moment opens at Affinity ${nextAt}.`
                      : 'Every current milestone has been preserved.'}
                </p>

                <div className={styles.milestones} aria-label="Affinity scene milestones">
                  {SCENE_MILESTONES.map((milestone, index) => (
                    <span
                      key={milestone}
                      title={`Affinity ${milestone}`}
                      className={`${styles.milestone} ${
                        index < used
                          ? styles.milestoneClaimed
                          : index < earned
                            ? styles.milestoneAvailable
                            : ''
                      }`}
                    />
                  ))}
                </div>

                {canGenerate ? (
                  <form action={generateCompanionImage}>
                    <input type="hidden" name="slug" value={slug} />
                    <button type="submit" className={styles.claimButton}>
                      Preserve scene {used + 1}
                    </button>
                  </form>
                ) : (
                  <p className={styles.emptyCopy}>
                    Complete quests and speak with her to deepen affinity.
                  </p>
                )}

                <Link
                  href={`/gallery?character=${encodeURIComponent(characterName)}`}
                  className={styles.galleryLink}
                >
                  Open her gallery
                </Link>
              </div>

              <div className={`${styles.experienceCard} ${styles.experienceCardGold}`}>
                <p className={styles.panelKicker}>Date night</p>
                <p className={styles.experienceValue}>A night chosen together</p>
                <p className={styles.panelCopy}>
                  Dates are separate from affinity scenes. They create their own message, image,
                  and shared memory without using a scene slot.
                </p>
                <div className={styles.dateButtonWrap}>
                  <TakeOnDateButton
                    slug={slug}
                    gold={standing.total_gold}
                    dateCoins={standing.date_coins}
                    action={takeCompanionOnDate}
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <MythicSectionHeader
              title="What She Remembers"
              hint={filteredMemories.length ? `${filteredMemories.length} recent` : 'History is forming'}
              sigil="◇"
            />

            {filteredMemories.length > 0 ? (
              <div className={styles.memoryList}>
                {filteredMemories.map(
                  (message: { id: string; content: string }, index: number) => (
                    <article className={styles.memoryCard} key={message.id}>
                      <span className={styles.memoryMark}>{index + 1}</span>
                      <p className={styles.memoryText}>{message.content}</p>
                    </article>
                  )
                )}
              </div>
            ) : (
              <MythicEmptyState
                title="No shared words have settled here yet"
                body="Complete quests and speak with her. The moments she carries forward will appear here."
                mark="◇"
              />
            )}
          </section>
        </div>
      ) : (
        <MythicEmptyState
          title="Her path cannot be found"
          body="Return to the roster and choose an awakened companion."
        />
      )}
    </MythicPage>
  )
}
