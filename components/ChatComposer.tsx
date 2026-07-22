'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-5 py-2.5 rounded-xl text-white text-sm font-medium transition ${
        pending
          ? 'bg-violet-800 cursor-wait opacity-80'
          : 'bg-violet-600 hover:bg-violet-500 active:scale-95'
      }`}
    >
      {pending ? '…' : 'Send'}
    </button>
  )
}

export default function ChatComposer({
  companionSlug,
  displayName,
  action,
}: {
  companionSlug: string
  displayName: string
  action: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [waitingReply, setWaitingReply] = useState(false)
  const [, startTransition] = useTransition()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setWaitingReply(false)
  }

  function startPoll() {
    stopPoll()
    setWaitingReply(true)
    let ticks = 0
    pollRef.current = setInterval(() => {
      ticks += 1
      startTransition(() => {
        router.refresh()
      })
      // ~20s of polling then stop
      if (ticks >= 12) stopPoll()
    }, 1600)
  }

  async function clientAction(formData: FormData) {
    const text = String(formData.get('content') || '').trim()
    if (!text) return

    await action(formData)

    if (inputRef.current) inputRef.current.value = ''
    // User message is in DB; keep refreshing until her reply lands
    startPoll()
  }

  return (
    <div className="shrink-0 px-4 pt-2 pb-3 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-md">
      {waitingReply && (
        <p className="text-[11px] text-zinc-500 mb-1.5 px-1 animate-pulse">
          {displayName} is writing…
        </p>
      )}
      <form action={clientAction}>
        <input type="hidden" name="companion_slug" value={companionSlug} />
        <div className="flex gap-2 items-center bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5">
          <input
            ref={inputRef}
            type="text"
            name="content"
            placeholder={`Reply to ${displayName}...`}
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-zinc-500 text-[15px] focus:outline-none"
            autoComplete="off"
          />
          <SendButton />
        </div>
      </form>
    </div>
  )
}
