import Link from 'next/link'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getCompanionDef } from '@/lib/companions'
import { companionRelationshipState } from '@/lib/companion-presentation'
import { companionTone } from '@/lib/companion-tone'
import { markConversationRead } from '@/lib/reads'
import {
  parseCampfireDigest,
  saveCampfireDigest,
  synthesizeCampfireReflection,
  type CampfireDigest,
  type CampfireEnergy,
} from '@/lib/campfire-director'
import {
  collectCampfireActionItems,
  saveCampfireActionBatch,
  synthesizeCampfireActions,
  type CampfireActionItem,
  type CampfireActionKind,
  type OpenTaskForAction,
} from '@/lib/campfire-actions'
import CompanionAvatar from '@/components/CompanionAvatar'
import CampfireComposer from '@/components/CampfireComposer'
import ChatThread from '@/components/ChatThread'
import { MythicIcon } from '@/components/MythicIcons'
import { PendingActionButton } from '@/components/PendingSubmit'
import { resolveCampfireAction } from './action-actions'
import styles from './camp.module.css'
import directorStyles from './director.module.css'
import actionStyles from './action-bridge.module.css'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type MessageRow = {
  id: string
  role: string
  content: string
  companion_slug?: string | null
  created_at?: string | null
}

const CAMPFIRE_MARKER = '\u2063\u2063'

const ENERGY_LABEL: Record<CampfireEnergy, string> = {
  low: 'Low flame',
  steady: 'Steady flame',
  high: 'Bright flame',
  mixed: 'Changing flame',
}

const CAMPFIRE_OPENERS: Record<string, string> = {
  seraphine: 'Come sit with me. How was your day — really?',
  kira_foxveil: 'You made it back. Start with the part you keep replaying.',
  ember_crimsonfall: 'All right. Best thing, worst thing. Do not polish it for me.',
  nyx_voidbane: 'Leave the noise outside. Tell me what happened.',
  mira_quillweave: 'I saved your place. What deserves to be remembered from today?',
  lyra_dawnforge: 'Sit down before you carry the whole day into tomorrow. How are you?',
  kael_ashrunner: 'There you are. What kind of trail did today turn into?',
  selene_tideglass: 'You can let the day loosen its grip here. Tell me where the tide took you.',
  iris_bellweather: 'I want the honest version — funny, messy, all of it. How was today?',
  seris_nightthorn: 'No performance tonight. Tell me what was real.',
  rowan_ironmane: 'The fire is warm and nobody needs anything from you for a minute. Talk to me.',
  elias_stillwater: 'Take one breath first. Then tell me what today left behind.',
  bramble_mossheart: 'I kept the fire going. What grew today, and what got bruised?',
}

function chicagoDateKey(value: Date | string | null | undefined): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value instanceof Date ? value : new Date(value))
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
}

function isCampfireMessage(message: MessageRow): boolean {
  return message.role !== 'system' && message.content.startsWith(CAMPFIRE_MARKER)
}

function revealCampfireMessage(message: MessageRow): MessageRow {
  return {
    ...message,
    content: message.content.slice(CAMPFIRE_MARKER.length),
  }
}

function latestDigestForToday(thread: MessageRow[], today: string): CampfireDigest | null {
  for (const message of [...thread].reverse()) {
    const digest = parseCampfireDigest(message.content)
    if (digest?.date === today) return digest
  }
  return null
}

function actionKindLabel(kind: CampfireActionKind): string {
  if (kind === 'complete_existing') return 'Possible completed quest'
  if (kind === 'schedule_existing_tomorrow') return 'Possible plan for tomorrow'
  return 'Possible new quest for tomorrow'
}

function actionButtonLabel(kind: CampfireActionKind): string {
  if (kind === 'complete_existing') return 'Mark complete'
  if (kind === 'schedule_existing_tomorrow') return 'Put on tomorrow'
  return 'Add for tomorrow'
}

function actionPendingLabel(kind: CampfireActionKind): string {
  if (kind === 'complete_existing') return 'Completing…'
  return 'Scheduling…'
}

function resolutionLabel(item: CampfireActionItem): string {
  if (!item.resolution) return ''
  if (item.resolution.decision === 'remembered') return 'Kept as memory only — no task changed.'
  if (item.resolution.decision === 'ignored') return 'Dismissed — nothing changed.'
  if (item.kind === 'complete_existing') return 'Quest marked complete.'
  if (item.kind === 'schedule_existing_tomorrow') return 'Quest set aside for tomorrow.'
  return 'New quest added for tomorrow.'
}

async function shareReflection(formData: FormData) {
  'use server'

  const content = String(formData.get('content') || '').trim()
  const companionSlug = String(formData.get('companion_slug') || 'seraphine')
  if (!content) return

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    role: 'user',
    content: `${CAMPFIRE_MARKER}${content}`,
    companion_slug: companionSlug,
  })

  if (error) {
    console.error('campfire reflection insert failed', error)
    return
  }

  await markConversationRead(companionSlug)
  revalidatePath('/camp')
  revalidatePath('/messages')
  revalidatePath('/')

  after(async () => {
    try {
      const replyWindowStart = new Date(Date.now() - 2000).toISOString()
      const { data: openTaskRows, error: taskQueryError } = await supabase
        .from('tasks')
        .select('id, title, is_today, must_do')
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(200)

      if (taskQueryError) console.error('campfire action task query failed', taskQueryError)
      const openTasks = (openTaskRows || []) as OpenTaskForAction[]

      const [digest, actionBatch] = await Promise.all([
        synthesizeCampfireReflection(content, companionSlug),
        synthesizeCampfireActions(content, companionSlug, openTasks),
      ])

      await Promise.all([
        saveCampfireDigest(digest),
        actionBatch ? saveCampfireActionBatch(actionBatch) : Promise.resolve(null),
      ])

      const { generateCompanionResponse } = await import('../actions')
      const reply = await generateCompanionResponse(content, 'reflection', {
        force: true,
        isConversation: true,
        companionSlug,
      })

      if (reply) {
        const { data: generatedMessages, error: lookupError } = await supabase
          .from('messages')
          .select('id, content, created_at')
          .eq('role', 'companion')
          .eq('companion_slug', companionSlug)
          .gte('created_at', replyWindowStart)
          .order('created_at', { ascending: false })
          .limit(4)

        if (lookupError) {
          console.error('campfire reply lookup failed', lookupError)
        } else {
          const generated = (generatedMessages || []).find((message) => message.content === reply)
          if (generated) {
            const { error: tagError } = await supabase
              .from('messages')
              .update({ content: `${CAMPFIRE_MARKER}${reply}` })
              .eq('id', generated.id)

            if (tagError) console.error('campfire reply tagging failed', tagError)
          }
        }
      }

      revalidatePath('/camp')
      revalidatePath('/messages')
      revalidatePath('/')
    } catch (error) {
      console.error('campfire background direction failed', error)
    }
  })
}

export default async function CampPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const params = await searchParams
  const requestedSlug = params.c || 'seraphine'
  const supabase = await createClient()

  const [{ data: companions }, { data: recentMessages }] = await Promise.all([
    supabase.from('companion').select('*').or('is_unlocked.eq.true,is_unlocked.is.null'),
    supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(260),
  ])

  const party = (companions || []).map((companion) => ({
    ...companion,
    slug:
      companion.slug ||
      (companion.name === 'Seraphine'
        ? 'seraphine'
        : companion.name?.toLowerCase().replace(/\s+/g, '_')),
  }))

  const companion =
    party.find((row) => row.slug === requestedSlug) ||
    party.find((row) => row.name === 'Seraphine') ||
    null
  const activeSlug = companion?.slug || requestedSlug
  const def = getCompanionDef(activeSlug)
  const displayName = companion?.name || def?.name || 'Seraphine'
  const relationship = companionRelationshipState(companion, activeSlug)
  const tone = companionTone(activeSlug)
  const today = chicagoDateKey(new Date())

  const thread = ((recentMessages || []) as MessageRow[])
    .filter((message) => {
      if (activeSlug === 'seraphine') {
        return !message.companion_slug || message.companion_slug === 'seraphine'
      }
      return message.companion_slug === activeSlug
    })
    .reverse()

  const todayThread = thread
    .filter((message) => isCampfireMessage(message) && chicagoDateKey(message.created_at) === today)
    .map(revealCampfireMessage)
    .slice(-24)
  const digest = latestDigestForToday(thread, today)
  const actionItems = collectCampfireActionItems(thread, today)
  const reflectionCount = todayThread.filter((message) => message.role === 'user').length
  const keptThreads = digest?.whatMattered.length
    ? digest.whatMattered
    : [...(digest?.brightSpots || []), ...(digest?.weight || [])].slice(0, 3)
  const opener =
    CAMPFIRE_OPENERS[activeSlug] ||
    `Come sit with me. Tell me how today felt${displayName === 'Seraphine' ? '' : ', honestly'}.`

  await markConversationRead(activeSlug)

  return (
    <main className={`${styles.campPage} safe-bottom`} data-tone={tone}>
      <div className={styles.stars} aria-hidden />
      <div className={styles.fireGlow} aria-hidden />

      <header className={styles.topbar}>
        <Link href="/" className={styles.backButton} aria-label="Back to Home">‹</Link>
        <div>
          <p className={styles.eyebrow}>A daily ritual</p>
          <h1>Evening Campfire</h1>
        </div>
        <Link href={`/messages?c=${activeSlug}`} className={styles.lettersButton} aria-label="Open full correspondence">
          <MythicIcon name="messages" size={18} />
        </Link>
      </header>

      <section className={styles.scene} aria-label={`${displayName} waits beside the campfire`}>
        <div className={styles.sceneMist} aria-hidden />
        <div className={styles.companionSeat}>
          <div className={styles.portraitHalo}>
            <CompanionAvatar
              slug={activeSlug}
              name={displayName}
              emoji={def?.emoji || '✦'}
              imageUrl={companion?.image_url}
              size="lg"
            />
          </div>
          <div className={styles.companionCopy}>
            <p>{def?.title || relationship.stage}</p>
            <h2>{displayName}</h2>
            <span>{relationship.mood}</span>
          </div>
        </div>

        <div className={styles.fire} aria-hidden>
          <span className={styles.flameOuter} />
          <span className={styles.flameMiddle} />
          <span className={styles.flameInner} />
          <span className={styles.logOne} />
          <span className={styles.logTwo} />
        </div>

        <blockquote className={styles.opener}>“{opener}”</blockquote>
      </section>

      {party.length > 1 && (
        <section className={styles.partyRail} aria-label="Choose a companion for the campfire">
          {party.map((member) => {
            const memberDef = getCompanionDef(member.slug)
            const memberName = member.name || memberDef?.name || 'Companion'
            const isActive = member.slug === activeSlug
            return (
              <Link
                key={member.id || member.slug}
                href={`/camp?c=${member.slug}`}
                className={`${styles.partyMember} ${isActive ? styles.activeMember : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <CompanionAvatar
                  slug={member.slug}
                  name={memberName}
                  emoji={memberDef?.emoji || '✦'}
                  imageUrl={member.image_url}
                  preferChibi
                  size="sm"
                />
                <span>{memberName}</span>
              </Link>
            )
          })}
        </section>
      )}

      <section className={styles.reflectionShell} aria-label="Today's campfire reflection">
        <header className={styles.reflectionHeader}>
          <div>
            <p>{todayLabel()}</p>
            <h2>{reflectionCount > 0 ? 'The conversation continues' : 'A quiet place to remember today'}</h2>
          </div>
          <div className={styles.noScore}>
            <MythicIcon name="relationship" size={15} />
            <span>No score. No streak.</span>
          </div>
        </header>

        {todayThread.length > 0 ? (
          <div className={styles.threadFrame}>
            <ChatThread
              messages={todayThread}
              companionName={displayName}
              companionSlug={activeSlug}
            />
          </div>
        ) : (
          <div className={styles.firstReflection}>
            <div className={styles.memoryRune} aria-hidden>
              <MythicIcon name="messages" size={24} />
            </div>
            <p>You do not need to summarize everything.</p>
            <span>Start with the moment that still has your attention. Your words remain in your shared correspondence and become part of what {displayName} remembers.</span>
          </div>
        )}

        {digest && (
          <aside className={directorStyles.card} aria-label="What the fire kept from today">
            <header className={directorStyles.header}>
              <div>
                <p>What the fire kept</p>
                <span>{ENERGY_LABEL[digest.energy]}</span>
              </div>
              <div className={directorStyles.seal} aria-hidden>
                <MythicIcon name="spark" size={17} />
              </div>
            </header>
            <h3 className={directorStyles.headline}>{digest.headline}</h3>
            <p className={directorStyles.weather}>{digest.emotionalWeather}</p>

            {keptThreads.length > 0 && (
              <div className={directorStyles.threads}>
                {keptThreads.slice(0, 3).map((threadLine, index) => (
                  <div className={directorStyles.thread} key={`${threadLine}-${index}`}>
                    <span aria-hidden>{index + 1}</span>
                    <p>{threadLine}</p>
                  </div>
                ))}
              </div>
            )}

            {digest.carryForward && (
              <div className={directorStyles.carry}>
                <p>Still open</p>
                <span>{digest.carryForward}</span>
              </div>
            )}

            <p className={directorStyles.foot}>
              {displayName} can remember this tomorrow. Nothing here changes your tasks unless you choose it.
            </p>
          </aside>
        )}

        {actionItems.length > 0 && (
          <aside className={actionStyles.bridge} aria-label="Optional task updates noticed in the reflection">
            <header className={actionStyles.header}>
              <div>
                <p className={actionStyles.eyebrow}>Consent-based action bridge</p>
                <h3>The fire noticed something actionable.</h3>
                <p>These are suggestions, not decisions. Nothing changes until you choose.</p>
              </div>
              <div className={actionStyles.lock} aria-hidden>
                <MythicIcon name="plan" size={17} />
              </div>
            </header>

            <div className={actionStyles.list}>
              {actionItems.map((item) => (
                <article className={actionStyles.item} key={`${item.batchId}:${item.id}`}>
                  <div className={actionStyles.itemTop}>
                    <div>
                      <p className={actionStyles.kind}>{actionKindLabel(item.kind)}</p>
                      <h4 className={actionStyles.title}>{item.title}</h4>
                    </div>
                    <span className={actionStyles.confidence}>{item.confidence}</span>
                  </div>
                  <p className={actionStyles.evidence}>“{item.evidence}”</p>

                  {item.resolution ? (
                    <div className={actionStyles.resolved}>
                      <span className={actionStyles.resolvedMark} aria-hidden>✓</span>
                      <span>{resolutionLabel(item)}</span>
                    </div>
                  ) : (
                    <div className={actionStyles.actions}>
                      <form action={resolveCampfireAction}>
                        <input type="hidden" name="batch_id" value={item.batchId} />
                        <input type="hidden" name="proposal_id" value={item.id} />
                        <input type="hidden" name="choice" value="apply" />
                        <PendingActionButton
                          label={actionButtonLabel(item.kind)}
                          pendingLabel={actionPendingLabel(item.kind)}
                          className={actionStyles.primary}
                        />
                      </form>
                      <form action={resolveCampfireAction}>
                        <input type="hidden" name="batch_id" value={item.batchId} />
                        <input type="hidden" name="proposal_id" value={item.id} />
                        <input type="hidden" name="choice" value="remember" />
                        <PendingActionButton label="Remember only" className={actionStyles.secondary} />
                      </form>
                      <form action={resolveCampfireAction}>
                        <input type="hidden" name="batch_id" value={item.batchId} />
                        <input type="hidden" name="proposal_id" value={item.id} />
                        <input type="hidden" name="choice" value="ignore" />
                        <PendingActionButton label="Ignore" className={actionStyles.ghost} />
                      </form>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <p className={actionStyles.footer}>
              Completing an existing quest uses the normal reward pipeline. Tomorrow plans stay off Today until tomorrow arrives.
            </p>
          </aside>
        )}

        <CampfireComposer
          companionSlug={activeSlug}
          displayName={displayName}
          action={shareReflection}
        />
      </section>

      <footer className={styles.footer}>
        <Link href={`/messages?c=${activeSlug}`}>Open the full memory of this bond</Link>
        <p>The app records the conversation. Your life remains the story.</p>
      </footer>
    </main>
  )
}
