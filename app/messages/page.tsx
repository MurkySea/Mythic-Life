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

export const dynamic = 'force-dynamic'

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
      const { generateCompanionResponse } = await import('../actions')
      const reply = await generateCompanionResponse(text, 'conversation', {
        force: true,
        isConversation: true,
        companionSlug,
      })
      revalidatePath('/messages')

      if (reply && typeof reply === 'string') {
        const def = getCompanionDef(companionSlug)
        const name = def?.name || 'Companion'
        const emoji = def?.emoji || '✦'
        const messageCreatedAt = new Date().toISOString()
        // Push only if still unread ~5s later (user left the thread)
        await pushIfStillUnread({
          companionSlug,
          messageCreatedAt,
          title: `${emoji} ${name}`,
          body: reply.trim().slice(0, 120),
          tag: `chat-${companionSlug}`,
        })
      }
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
    for (const m of allMessages || []) {
      const slug = m.companion_slug || 'seraphine'
      if (!lastBySlug[slug]) {
        lastBySlug[slug] = {
          content: m.content,
          created_at: m.created_at,
          role: m.role,
        }
      }
    }

    const rows = party.map((c) => {
      const last = lastBySlug[c.slug]
      const unread = isUnread(last, readMap[c.slug])
      return { c, last, unread }
    })

    rows.sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1
      const ta = a.last?.created_at ? new Date(a.last.created_at).getTime() : 0
      const tb = b.last?.created_at ? new Date(b.last.created_at).getTime() : 0
      return tb - ta
    })

    return (
      <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            ←
          </Link>
          <div>
            <p className="text-zinc-500 text-xs tracking-wide uppercase">Inbox</p>
            <h1 className="text-xl font-medium text-white tracking-tight">Messages</h1>
          </div>
        </div>

        <div className="space-y-0.5">
          {rows.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-16">No companions unlocked yet.</p>
          ) : (
            rows.map(({ c, last, unread }) => {
              const def = getCompanionDef(c.slug)
              return (
                <Link
                  key={c.id || c.slug}
                  href={`/messages?c=${c.slug}`}
                  className="flex items-center gap-3 px-2 py-3.5 rounded-xl hover:bg-zinc-900/80 transition"
                >
                  <div className="relative shrink-0">
                    <CompanionAvatar
                      slug={c.slug}
                      name={c.name}
                      emoji={def?.emoji || '✦'}
                      imageUrl={c.image_url}
                      preferChibi
                      size="md"
                    />
                    {unread && (
                      <span
                        className="absolute -left-0.5 top-1/2 -translate-y-1/2 -translate-x-full w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_0_2px_rgb(9,9,11)]"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate ${unread ? 'font-semibold text-white' : 'font-medium text-zinc-200'}`}
                      >
                        {c.name}
                      </p>
                      <span
                        className={`text-xs shrink-0 ${unread ? 'text-blue-400 font-medium' : 'text-zinc-600'}`}
                      >
                        {formatInboxTime(last?.created_at)}
                      </span>
                    </div>
                    <p
                      className={`text-sm truncate mt-0.5 ${unread ? 'text-zinc-300' : 'text-zinc-500'}`}
                    >
                      {last?.content || 'No messages yet — say hello.'}
                    </p>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </main>
    )
  }

  await markConversationRead(activeSlug)

  const [{ data: companions }, { data: messages }] = await Promise.all([
    supabase.from('companion').select('*').or('is_unlocked.eq.true,is_unlocked.is.null'),
    supabase.from('messages').select('*').order('created_at', { ascending: true }),
  ])

  const party = (companions || []).map((c) => ({
    ...c,
    slug:
      c.slug ||
      (c.name === 'Seraphine' ? 'seraphine' : c.name?.toLowerCase().replace(/\s+/g, '_')),
  }))

  const companion =
    party.find((c) => c.slug === activeSlug) ||
    party.find((c) => c.name === 'Seraphine') ||
    null
  const def = getCompanionDef(activeSlug)
  const displayName = companion?.name || def?.name || 'Companion'

  const thread = (messages || []).filter((m) => {
    if (activeSlug === 'seraphine') {
      return !m.companion_slug || m.companion_slug === 'seraphine'
    }
    return m.companion_slug === activeSlug
  })

  return (
    <main className="max-w-md mx-auto h-[100dvh] flex flex-col pb-20">
      <div className="shrink-0 flex items-center gap-3 px-4 pt-6 pb-3 border-b border-zinc-900">
        <Link
          href="/messages"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <CompanionAvatar
          slug={activeSlug}
          name={displayName}
          emoji={def?.emoji || '✦'}
          imageUrl={companion?.image_url}
          preferChibi
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Conversation</p>
          <h1 className="text-xl font-medium text-white tracking-tight truncate">{displayName}</h1>
        </div>
      </div>

      <ChatThread
        messages={thread}
        companionName={displayName}
        companionSlug={activeSlug}
      />

      <ChatComposer
        companionSlug={activeSlug}
        displayName={displayName}
        action={sendMessage}
      />
    </main>
  )
}
