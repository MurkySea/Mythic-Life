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
