import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import Link from 'next/link'
import { getCompanionDef } from '@/lib/companions'
import {
  markConversationRead,
  getReadMap,
  isUnread,
  pushIfStillUnread,
} from '@/lib/reads'
import ChatThread from '@/components/ChatThread'
import ChatComposer from '@/components/ChatComposer'
import CompanionAvatar from '@/components/CompanionAvatar'
import MarkReadOnOpen from '@/components/MarkReadOnOpen'
import { MythicIcon } from '@/components/MythicIcons'
import { respondWithChoice } from '@/app/response-actions'
import {
  fulfillExplicitCompanionImageRequest,
  isCompanionImageRequest,
  maybeGenerateCompanionImageGift,
} from '@/lib/companion-image-gifts'
import { buildSceneAwareImageRequest } from '@/lib/companion-scene-context'
import { companionRelationshipState } from '@/lib/companion-presentation'
import { companionTone } from '@/lib/companion-tone'
import styles from './messages.module.css'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function formatInboxTime(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Chicago',
    })
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
}

function messagePreview(content: string | null | undefined): string {
  const clean = String(content || '')
    .replace(/\[image:[^\]]+\]/g, 'Shared a memory')
    .replace(/\s+/g, ' ')
    .trim()
  return clean || 'No letters yet — open the chamber.'
}

async function sendMessage(formData: FormData) {
  'use server'

  const content = formData.get('content') as string
  const companionSlug = (formData.get('companion_slug') as string) || 'seraphine'

  if (!content?.trim()) return

  const supabase = await createClient()
  const text = content.trim()

  await supabase.from('messages').insert({
    role: 'user',
    content: text,
    companion_slug: companionSlug,
  })

  await markConversationRead(companionSlug)

  revalidatePath('/messages')
  revalidatePath('/')

  after(async () => {
    try {
      const def = getCompanionDef(companionSlug)
      const name = def?.name || 'Companion'
      const emoji = def?.emoji || '✦'
      const explicitImageRequest = isCompanionImageRequest(text)

      const { data: companion } = await supabase
        .from('companion')
        .select('name, affinity_score')
        .or(`slug.eq.${companionSlug},name.eq.${def?.name || 'Seraphine'}`)
        .maybeSingle()

      const characterName = companion?.name || name
      const affinity = Number(companion?.affinity_score) || 1

      // An explicit image request is an action, not ordinary dialogue. This hard
      // branch prevents the companion from answering with hypothetical prose.
      if (explicitImageRequest) {
        const recentBaseQuery = supabase
          .from('messages')
          .select('role, content, created_at')
        const recentScopedQuery =
          companionSlug === 'seraphine'
            ? recentBaseQuery.or('companion_slug.is.null,companion_slug.eq.seraphine')
            : recentBaseQuery.eq('companion_slug', companionSlug)
        const { data: recentMessages, error: recentMessagesError } = await recentScopedQuery
          .order('created_at', { ascending: false })
          .limit(12)

        if (recentMessagesError) {
          console.error('recent scene context query failed', recentMessagesError)
        }

        const sceneAwareRequest = buildSceneAwareImageRequest({
          currentRequest: text,
          recentMessagesNewestFirst: recentMessages || [],
          companionName: characterName,
        })

        const result = await fulfillExplicitCompanionImageRequest({
          supabase,
          companionSlug,
          characterName,
          affinity,
          userText: sceneAwareRequest,
          def,
        })

        if (result.success) {
          const message = `${result.caption || 'Here.'}\n[image:${result.imageUrl}]`
          const { error } = await supabase.from('messages').insert({
            role: 'companion',
            content: message,
            companion_slug: companionSlug,
          })

          if (error) {
            console.error('explicit companion image message insert failed', error)
          }

          console.log('explicit companion image delivered', {
            companionSlug,
            promptSource: result.promptSource,
            imageModel: result.imageModel,
            recentSceneTurns: recentMessages?.length || 0,
          })

          revalidatePath('/messages')
          revalidatePath('/gallery')
          revalidatePath('/companion-profile')

          await pushIfStillUnread({
            companionSlug,
            messageCreatedAt: new Date().toISOString(),
            title: `${emoji} ${name}`,
            body: (result.caption || 'I made something for you.').slice(0, 120),
            tag: `chat-${companionSlug}`,
          })
          return
        }

        console.error('explicit companion image delivery failed', {
          companionSlug,
          stage: result.stage,
        })

        const { error } = await supabase.from('messages').insert({
          role: 'companion',
          content: result.fallbackText,
          companion_slug: companionSlug,
        })
        if (error) {
          console.error('explicit companion image failure message insert failed', error)
        }

        revalidatePath('/messages')

        await pushIfStillUnread({
          companionSlug,
          messageCreatedAt: new Date().toISOString(),
          title: `${emoji} ${name}`,
          body: result.fallbackText.slice(0, 120),
          tag: `chat-${companionSlug}`,
        })
        return
      }

      // Ordinary conversation remains unchanged.
      const { generateCompanionResponse } = await import('../actions')
      const reply = await generateCompanionResponse(text, 'conversation', {
        force: true,
        isConversation: true,
        companionSlug,
      })
      revalidatePath('/messages')

      if (!reply || typeof reply !== 'string') return

      // Close companions may independently choose a rare visual gift after a
      // normal reply. This path is optional and never blocks dialogue.
      try {
        const gift = await maybeGenerateCompanionImageGift({
          supabase,
          companionSlug,
          characterName,
          affinity,
          userText: text,
          companionReply: reply,
          def,
        })

        if (gift) {
          const { error } = await supabase.from('messages').insert({
            role: 'companion',
            content: `${gift.caption}\n[image:${gift.imageUrl}]`,
            companion_slug: companionSlug,
          })
          if (error) console.error('spontaneous companion image message insert failed', error)

          revalidatePath('/messages')
          revalidatePath('/gallery')
          revalidatePath('/companion-profile')
        }
      } catch (imageError) {
        console.error('spontaneous companion image gift failed', imageError)
      }

      await pushIfStillUnread({
        companionSlug,
        messageCreatedAt: new Date().toISOString(),
        title: `${emoji} ${name}`,
        body: reply.trim().slice(0, 120),
        tag: `chat-${companionSlug}`,
      })
    } catch (e) {
      console.error('background chat reply failed', e)
    }
  })
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const params = await searchParams
  const activeSlug = params.c || ''

  const supabase = await createClient()

  if (!activeSlug) {
    const [{ data: companions }, { data: allMessages }, readMap] = await Promise.all([
      supabase.from('companion').select('*').or('is_unlocked.eq.true,is_unlocked.is.null'),
      supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(300),
      getReadMap(),
    ])

    const party = (companions || []).map((c) => ({
      ...c,
      slug:
        c.slug ||
        (c.name === 'Seraphine' ? 'seraphine' : c.name?.toLowerCase().replace(/\s+/g, '_')),
    }))

    type LastMsg = { content: string; created_at: string; role: string }
    const lastBySlug: Record<string, LastMsg> = {}
    for (const message of allMessages || []) {
      const slug = message.companion_slug || 'seraphine'
      if (!lastBySlug[slug]) {
        lastBySlug[slug] = {
          content: message.content,
          created_at: message.created_at,
          role: message.role,
        }
      }
    }

    const rows = party.map((companion) => {
      const last = lastBySlug[companion.slug]
      const unread = isUnread(last, readMap[companion.slug])
      return { companion, last, unread }
    })

    rows.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1
      const ta = a.last?.created_at ? new Date(a.last.created_at).getTime() : 0
      const tb = b.last?.created_at ? new Date(b.last.created_at).getTime() : 0
      return tb - ta
    })

    return (
      <main className={styles.inboxPage}>
        <div className={styles.worldTexture} aria-hidden />
        <header className={styles.inboxHeader}>
          <Link href="/" className={styles.backButton} aria-label="Back to Home">‹</Link>
          <div>
            <p className={styles.headerEyebrow}>Correspondence chamber</p>
            <h1 className={styles.headerTitle}>Letters</h1>
          </div>
          <div className={styles.headerSeal} aria-hidden>
            <MythicIcon name="messages" size={23} />
          </div>
        </header>

        <section className={styles.introPanel}>
          <p className={styles.introTitle}>Voices beyond the firelight</p>
          <p className={styles.introBody}>
            Every letter belongs to one living bond. Unread words rise first; older conversations remain where you left them.
          </p>
        </section>

        <section className={styles.letterStack} aria-label="Companion correspondence">
          {rows.length === 0 ? (
            <div className={styles.emptyInbox}>
              <div className={styles.emptyMark} aria-hidden>
                <MythicIcon name="messages" size={24} />
              </div>
              <p className={styles.emptyTitle}>No voices have crossed the veil yet.</p>
              <p className={styles.emptyBody}>Unlock a companion and her letters will gather here.</p>
            </div>
          ) : (
            rows.map(({ companion, last, unread }) => {
              const def = getCompanionDef(companion.slug)
              const name = companion.name || def?.name || 'Companion'
              const relationship = companionRelationshipState(companion, companion.slug)
              const tone = companionTone(companion.slug)
              return (
                <Link
                  key={companion.id || companion.slug}
                  href={`/messages?c=${companion.slug}`}
                  className={`${styles.letter} ${unread ? styles.unread : ''}`}
                  data-tone={tone}
                  aria-label={`${unread ? 'Unread letter from' : 'Open correspondence with'} ${name}`}
                >
                  <div className={styles.portraitFrame}>
                    <CompanionAvatar
                      slug={companion.slug}
                      name={name}
                      emoji={def?.emoji || '✦'}
                      imageUrl={companion.image_url}
                      preferChibi
                      size="lg"
                    />
                  </div>
                  <div className={styles.letterCopy}>
                    <div className={styles.letterTop}>
                      <p className={styles.letterName}>{name}</p>
                      <span className={styles.letterTime}>{formatInboxTime(last?.created_at)}</span>
                    </div>
                    <p className={styles.relationshipLine}>{relationship.stage} · {def?.title || relationship.mood}</p>
                    <p className={styles.preview}>
                      {last?.role === 'user' ? 'You · ' : ''}{messagePreview(last?.content)}
                    </p>
                  </div>
                  <span className={styles.waxSeal} aria-hidden>
                    <MythicIcon name={unread ? 'messages' : 'relationship'} size={15} />
                  </span>
                </Link>
              )
            })
          )}
        </section>
      </main>
    )
  }

  await markConversationRead(activeSlug)

  const [{ data: companions }, { data: messages }] = await Promise.all([
    supabase.from('companion').select('*').or('is_unlocked.eq.true,is_unlocked.is.null'),
    supabase.from('messages').select('*').order('created_at', { ascending: true }),
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
    party.find((row) => row.slug === activeSlug) ||
    party.find((row) => row.name === 'Seraphine') ||
    null
  const def = getCompanionDef(activeSlug)
  const displayName = companion?.name || def?.name || 'Companion'
  const relationship = companionRelationshipState(companion, activeSlug)
  const tone = companionTone(activeSlug)

  const thread = (messages || []).filter((message) => {
    if (activeSlug === 'seraphine') {
      return !message.companion_slug || message.companion_slug === 'seraphine'
    }
    return message.companion_slug === activeSlug
  })

  const lastMsg = thread[thread.length - 1]
  const lastMessageIsCompanion = lastMsg?.role === 'companion'
  const lastCompanionContent =
    lastMessageIsCompanion && typeof lastMsg?.content === 'string' ? lastMsg.content : null

  return (
    <main className={styles.threadPage} data-tone={tone}>
      <div className={styles.worldTexture} aria-hidden />
      <MarkReadOnOpen companionSlug={activeSlug} />

      <header className={styles.threadHeader}>
        <Link href="/messages" className={styles.threadBack} aria-label="Back to Letters">‹</Link>
        <div className={styles.threadPortrait}>
          <CompanionAvatar
            slug={activeSlug}
            name={displayName}
            emoji={def?.emoji || '✦'}
            imageUrl={companion?.image_url}
            preferChibi
            size="lg"
          />
        </div>
        <div className={styles.threadCopy}>
          <p className={styles.threadEyebrow}>{def?.title || 'Private correspondence'}</p>
          <h1 className={styles.threadTitle}>{displayName}</h1>
          <p className={styles.threadMood}>{relationship.mood}</p>
        </div>
        <div className={styles.stageSeal}>{relationship.stage}</div>
      </header>

      <div className={styles.threadDivider}>Private chamber</div>

      <ChatThread
        messages={thread}
        companionName={displayName}
        companionSlug={activeSlug}
      />

      <ChatComposer
        companionSlug={activeSlug}
        displayName={displayName}
        action={sendMessage}
        responseAction={respondWithChoice}
        lastMessageIsCompanion={lastMessageIsCompanion}
        lastCompanionContent={lastCompanionContent}
      />
    </main>
  )
}
