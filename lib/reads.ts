import { createClient } from '@/utils/supabase/server'

/** Mark a conversation as read up to now. */
export async function markConversationRead(companionSlug: string) {
  const supabase = await createClient()
  try {
    await supabase.from('conversation_reads').upsert(
      {
        companion_slug: companionSlug,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'companion_slug' }
    )
  } catch (e) {
    console.error('mark read', e)
  }
}

/** Map of companion_slug → last_read_at ISO string */
export async function getReadMap(): Promise<Record<string, string>> {
  const supabase = await createClient()
  try {
    const { data } = await supabase.from('conversation_reads').select('companion_slug, last_read_at')
    const map: Record<string, string> = {}
    for (const row of data || []) {
      if (row.companion_slug && row.last_read_at) {
        map[row.companion_slug] = row.last_read_at
      }
    }
    return map
  } catch {
    return {}
  }
}

export function isUnread(
  lastMessage: { role: string; created_at: string } | null | undefined,
  lastReadAt: string | undefined
): boolean {
  if (!lastMessage) return false
  if (lastMessage.role !== 'companion') return false
  if (!lastReadAt) return true
  return new Date(lastMessage.created_at).getTime() > new Date(lastReadAt).getTime()
}

/** True if the user has marked this thread read at or after `sinceISO`. */
export async function wasReadSince(
  companionSlug: string,
  sinceISO: string
): Promise<boolean> {
  const supabase = await createClient()
  try {
    const { data } = await supabase
      .from('conversation_reads')
      .select('last_read_at')
      .eq('companion_slug', companionSlug)
      .maybeSingle()
    if (!data?.last_read_at) return false
    return new Date(data.last_read_at).getTime() >= new Date(sinceISO).getTime()
  } catch {
    return false
  }
}

const PUSH_UNREAD_DELAY_MS = 5000

/**
 * Wait briefly, then push only if the conversation is still unread.
 * If the user is on the chat screen, mark-read will fire and suppress the push.
 */
export async function pushIfStillUnread(opts: {
  companionSlug: string
  messageCreatedAt: string
  title: string
  body: string
  tag?: string
}): Promise<{ pushed: boolean }> {
  const { companionSlug, messageCreatedAt, title, body, tag } = opts

  await new Promise((r) => setTimeout(r, PUSH_UNREAD_DELAY_MS))

  const read = await wasReadSince(companionSlug, messageCreatedAt)
  if (read) return { pushed: false }

  try {
    const { sendPushToAll } = await import('@/lib/push')
    const result = await sendPushToAll({
      title,
      body,
      url: `/messages?c=${companionSlug}`,
      tag: tag || `chat-${companionSlug}`,
    })
    return { pushed: result.sent > 0 }
  } catch (e) {
    console.error('pushIfStillUnread', e)
    return { pushed: false }
  }
}
