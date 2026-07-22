import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import Link from 'next/link'
import { getCompanionDef } from '@/lib/companions'
import { checkAndUnlockCompanions } from '../actions'
import ChatThread from '@/components/ChatThread'
import ChatComposer from '@/components/ChatComposer'

export const dynamic = 'force-dynamic'

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

  revalidatePath('/messages')
  revalidatePath('/')

  after(async () => {
    try {
      const { generateCompanionResponse } = await import('../actions')
      await generateCompanionResponse(text, 'conversation', {
        force: true,
        isConversation: true,
        companionSlug,
      })
      revalidatePath('/messages')
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
  await checkAndUnlockCompanions()

  const params = await searchParams
  const activeSlug = params.c || ''

  const supabase = await createClient()

  const { data: companions } = await supabase
    .from('companion')
    .select('*')
    .or('is_unlocked.eq.true,is_unlocked.is.null')

  const party = (companions || []).map((c) => ({
    ...c,
    slug:
      c.slug ||
      (c.name === 'Seraphine' ? 'seraphine' : c.name?.toLowerCase().replace(/\s+/g, '_')),
  }))

  if (!activeSlug) {
    const { data: allMessages } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    const lastBySlug: Record<string, { content: string; created_at: string }> = {}
    for (const m of allMessages || []) {
      const slug = m.companion_slug || 'seraphine'
      if (!lastBySlug[slug]) {
        lastBySlug[slug] = { content: m.content, created_at: m.created_at }
      }
    }

    return (
      <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
        <div className="flex items-center gap-3 mb-8">
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

        <div className="space-y-2">
          {party.length === 0 ? (
            <p className="text-center text-zinc-500 text-sm py-16">No companions unlocked yet.</p>
          ) : (
            party.map((c) => {
              const def = getCompanionDef(c.slug)
              const last = lastBySlug[c.slug]
              return (
                <Link
                  key={c.id || c.slug}
                  href={`/messages?c=${c.slug}`}
                  className="flex items-center gap-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 hover:border-violet-700/40 transition"
                >
                  <div className="w-12 h-12 rounded-full bg-violet-900/40 border border-violet-700/40 flex items-center justify-center text-xl shrink-0">
                    {def?.emoji || '✦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {last?.content || 'No messages yet — say hello.'}
                    </p>
                  </div>
                  <span className="text-zinc-600 text-sm">→</span>
                </Link>
              )
            })
          )}
        </div>
      </main>
    )
  }

  const companion =
    party.find((c) => c.slug === activeSlug) ||
    party.find((c) => c.name === 'Seraphine') ||
    null
  const def = getCompanionDef(activeSlug)
  const displayName = companion?.name || def?.name || 'Companion'

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })

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
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{def?.emoji || '✦'}</span>
          <div className="min-w-0">
            <p className="text-zinc-500 text-xs tracking-wide uppercase">Conversation</p>
            <h1 className="text-xl font-medium text-white tracking-tight truncate">{displayName}</h1>
          </div>
        </div>
      </div>

      <ChatThread messages={thread} companionName={displayName} />

      <ChatComposer
        companionSlug={activeSlug}
        displayName={displayName}
        action={sendMessage}
      />
    </main>
  )
}
