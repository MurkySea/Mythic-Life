'use client'

import { useEffect, useRef } from 'react'

type Msg = {
  id: string
  role: string
  content: string
}

function MessageBody({ content, isUser }: { content: string; isUser: boolean }) {
  // Support [image:url] markers from proactive share_moment messages
  const parts = content.split(/(\[image:[^\]]+\])/g)

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        const match = part.match(/^\[image:(.+)\]$/)
        if (match) {
          const src = match[1]
          return (
            <div key={i} className="mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Shared moment"
                className="rounded-xl max-w-full max-h-72 object-cover border border-zinc-700/60"
                loading="lazy"
              />
            </div>
          )
        }
        if (!part.trim()) return null
        return (
          <p
            key={i}
            className={`whitespace-pre-wrap ${isUser ? 'text-white' : 'text-zinc-200'}`}
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages.length, messages[messages.length - 1]?.id])

  // While this thread is open, keep marking it read so delayed pushes are suppressed
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
        // ignore offline / transient errors
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

  // Also mark read whenever a new companion message appears while we're here
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'companion') return
    fetch('/api/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companion_slug: companionSlug }),
    }).catch(() => {})
  }, [messages.length, messages[messages.length - 1]?.id, companionSlug])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 px-4">
        <div className="text-center py-16">
          <p className="text-sm">No messages yet.</p>
          <p className="mt-2 text-xs text-zinc-600">Say something — she is listening.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-4 space-y-5 pt-2 pb-4 min-h-0">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-md'
                : 'bg-zinc-900/90 border border-zinc-800/80 text-zinc-200 rounded-bl-md'
            }`}
          >
            {msg.role === 'companion' && (
              <p className="text-violet-400/90 text-[11px] font-medium mb-1.5 tracking-wide">
                {companionName}
              </p>
            )}
            <MessageBody content={msg.content} isUser={msg.role === 'user'} />
          </div>
        </div>
      ))}
      <div ref={bottomRef} className="h-1" aria-hidden />
    </div>
  )
}
