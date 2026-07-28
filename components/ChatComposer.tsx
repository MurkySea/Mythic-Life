'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import ResponseChoices, { type ResponseResult } from '@/components/ResponseChoices'
import { MythicIcon } from '@/components/MythicIcons'
import { companionTone } from '@/lib/companion-tone'
import styles from './chat-composer.module.css'

function SendButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={styles.sendButton}>
      <MythicIcon name="spark" size={16} />
      <span>{pending ? 'Sending' : 'Send'}</span>
    </button>
  )
}

export default function ChatComposer({
  companionSlug,
  displayName,
  action,
  responseAction,
  lastMessageIsCompanion = false,
  lastCompanionContent = null,
}: {
  companionSlug: string
  displayName: string
  action: (formData: FormData) => Promise<void>
  responseAction?: (formData: FormData) => Promise<ResponseResult | void>
  lastMessageIsCompanion?: boolean
  lastCompanionContent?: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [waitingReply, setWaitingReply] = useState(false)
  const [, startTransition] = useTransition()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tone = companionTone(companionSlug)

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
      if (ticks >= 12) stopPoll()
    }, 1600)
  }

  async function clientAction(formData: FormData) {
    const text = String(formData.get('content') || '').trim()
    if (!text) return

    await action(formData)

    if (inputRef.current) inputRef.current.value = ''
    startPoll()
  }

  async function onResponseChoice(formData: FormData): Promise<ResponseResult | void> {
    if (!responseAction) return
    const result = await responseAction(formData)
    startPoll()
    return result
  }

  return (
    <div className={styles.composer} data-tone={tone}>
      {responseAction && (
        <ResponseChoices
          companionSlug={companionSlug}
          action={onResponseChoice}
          visible={lastMessageIsCompanion && !waitingReply}
          lastCompanionContent={lastCompanionContent}
        />
      )}

      {waitingReply && (
        <div className={styles.waiting} role="status">
          <span className={styles.runes} aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span>{displayName} is shaping a reply…</span>
        </div>
      )}

      <form action={clientAction}>
        <input type="hidden" name="companion_slug" value={companionSlug} />
        <div className={styles.formShell}>
          <input
            ref={inputRef}
            type="text"
            name="content"
            placeholder={`Write to ${displayName}…`}
            className={styles.input}
            autoComplete="off"
            aria-label={`Message ${displayName}`}
          />
          <SendButton />
        </div>
      </form>
      <p className={styles.footerHint}>Speak plainly. The chamber remembers what matters.</p>
    </div>
  )
}
