import { createClient } from '@/utils/supabase/server'

/**
 * Mark a conversation as fully read up to now.
 * This is the single source of truth for clearing the blue dot.
 *
 * Rules encoded:
 * - Opening a conversation marks everything current as read
 * - New messages that arrive while the chat is open are instantly treated as read
 *   (the client heartbeat + the effect in ChatThread keep calling this)
 */
export async function markConversationRead(companionSlug: string): Promise<boolean> {
  const supabase = await createClient()
  try {
    const { error } = await supabase.from('conversation_reads').upsert(
      {
        companion_slug: companionSlug,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'companion_slug' }
    )
    if (error) {
      console.error('markConversationRead upsert error', companionSlug, error)
      return false
    }
    return true
  } catch (e) {
    console.error('markConversationRead failed', companionSlug, e)
    return false
  }
}

/** Map of companion_slug → last_read_at ISO string */
export async function getReadMap(): Promise<Record<string, string>> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('conversation_reads')
      .select('companion_slug, last_read_at')

    if (error) {
      console.error('getReadMap error', error)
      return {}
    }

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

/**
 * A conversation is unread only when the last message is from the companion
 * and it is newer than the last time the player marked the thread read.
 */
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
 * If the user is on the chat screen, the heartbeat / open mark will suppress the push.
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
