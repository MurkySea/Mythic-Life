'use client'

import { useEffect, useRef } from 'react'
import { MythicIcon } from '@/components/MythicIcons'
import { companionTone } from '@/lib/companion-tone'
import styles from './chat-thread.module.css'

type Msg = {
  id: string
  role: string
  content: string
  created_at?: string | null
}

function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(new Date(iso))
}

function MessageBody({ content, isUser }: { content: string; isUser: boolean }) {
  const parts = content.split(/(\[image:[^\]]+\])/g)

  return (
    <div className={styles.body}>
      {parts.map((part, i) => {
        const match = part.match(/^\[image:(.+)\]$/)
        if (match) {
          const src = match[1]
          return (
            <figure key={i} className={styles.memoryFrame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Shared moment"
                className={styles.memoryImage}
                loading="lazy"
              />
            </figure>
          )
        }
        if (!part.trim()) return null
        return (
          <p
            key={i}
            className={`${styles.text} ${isUser ? styles.userText : styles.companionText}`}
          >
            {part.trim()}
          </p>
        )
      })}
    </div>
  )
}

export default function ChatThread({
  messages,
  companionName,
  companionSlug,
}: {
  messages: Msg[]
  companionName: string
  companionSlug: string
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const tone = companionTone(companionSlug)
  const visibleMessages = messages.filter((message) => message.role !== 'system')
  const lastVisible = visibleMessages[visibleMessages.length - 1]
  const lastVisibleId = lastVisible?.id
  const lastVisibleRole = lastVisible?.role

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [visibleMessages.length, lastVisibleId])

  useEffect(() => {
    let cancelled = false

    async function beat() {
      if (cancelled || document.visibilityState === 'hidden') return
      try {
        await fetch('/api/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companion_slug: companionSlug }),
        })
      } catch {
        // Ignore offline and transient read-heartbeat failures.
      }
    }

    beat()
    const id = setInterval(beat, 4000)
    const onVis = () => {
      if (document.visibilityState === 'visible') beat()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [companionSlug])

  useEffect(() => {
    if (!lastVisibleId || lastVisibleRole !== 'companion') return
    fetch('/api/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companion_slug: companionSlug }),
    }).catch(() => {})
  }, [lastVisibleId, lastVisibleRole, companionSlug])

  if (visibleMessages.length === 0) {
    return (
      <div className={styles.thread} data-tone={tone}>
        <div className={styles.empty}>
          <div className={styles.emptyCard}>
            <div className={styles.emptyRune} aria-hidden>
              <MythicIcon name="messages" size={24} />
            </div>
            <p className={styles.emptyTitle}>The chamber is quiet.</p>
            <p className={styles.emptyBody}>Speak first. {companionName} is listening beyond the firelight.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.thread} data-tone={tone}>
      <div className={styles.messageList}>
        {visibleMessages.map((msg) => {
          const isUser = msg.role === 'user'
          return (
            <article
              key={msg.id}
              className={`${styles.row} ${isUser ? styles.userRow : styles.companionRow}`}
            >
              <div
                className={`${styles.message} ${isUser ? styles.userMessage : styles.companionMessage}`}
              >
                {!isUser && <p className={styles.messageHeader}>{companionName}</p>}
                <MessageBody content={msg.content} isUser={isUser} />
                {msg.created_at && (
                  <p className={styles.timestamp}>{formatMessageTime(msg.created_at)}</p>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <div ref={bottomRef} className={styles.bottomAnchor} aria-hidden />
    </div>
  )
}
