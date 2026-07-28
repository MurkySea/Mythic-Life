'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { MythicIcon } from '@/components/MythicIcons'
import { companionTone } from '@/lib/companion-tone'
import styles from './campfire-composer.module.css'

type SpeechRecognitionResultLike = {
  0?: { transcript?: string }
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionErrorLike = {
  error?: string
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className={styles.sendButton} disabled={pending || disabled}>
      <MythicIcon name="spark" size={17} />
      <span>{pending ? 'Sharing' : 'Share'}</span>
    </button>
  )
}

export default function CampfireComposer({
  companionSlug,
  displayName,
  action,
}: {
  companionSlug: string
  displayName: string
  action: (formData: FormData) => Promise<void>
}) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [waitingReply, setWaitingReply] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const voiceBaseRef = useRef('')
  const tone = companionTone(companionSlug)

  useEffect(() => {
    const speechWindow = window as SpeechWindow
    setSpeechSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition))

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      recognitionRef.current?.stop()
    }
  }, [])

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
      startTransition(() => router.refresh())
      if (ticks >= 15) stopPoll()
    }, 1600)
  }

  async function clientAction(formData: FormData) {
    const text = String(formData.get('content') || '').trim()
    if (!text) return

    setVoiceError(null)
    recognitionRef.current?.stop()
    await action(formData)
    setDraft('')
    startPoll()
  }

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const speechWindow = window as SpeechWindow
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition

    if (!Recognition) {
      setVoiceError('Voice input is not available in this browser. You can still type normally.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    voiceBaseRef.current = draft.trim()

    recognition.onresult = (event) => {
      let transcript = ''
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript || ''
      }
      const spoken = transcript.trim()
      setDraft([voiceBaseRef.current, spoken].filter(Boolean).join(' '))
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      setVoiceError(
        event.error === 'not-allowed'
          ? 'Microphone access was blocked. Allow microphone access or keep typing.'
          : 'I could not catch that clearly. Try again or keep typing.'
      )
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setVoiceError(null)
    setIsListening(true)

    try {
      recognition.start()
    } catch {
      setIsListening(false)
      recognitionRef.current = null
      setVoiceError('Voice input could not start. You can still type normally.')
    }
  }

  return (
    <div className={styles.composer} data-tone={tone}>
      {waitingReply && (
        <div className={styles.waiting} role="status">
          <span className={styles.embers} aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span>{displayName} is thinking about what you said…</span>
        </div>
      )}

      <form action={clientAction} className={styles.form}>
        <input type="hidden" name="companion_slug" value={companionSlug} />
        <label htmlFor="campfire-reflection" className={styles.label}>
          Tell {displayName} about your day
        </label>
        <div className={styles.inputShell}>
          <textarea
            id="campfire-reflection"
            name="content"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            className={styles.textarea}
            placeholder="Start anywhere. A win, something hard, someone you thought about, or just how today felt…"
            rows={5}
            autoComplete="off"
          />

          <div className={styles.controls}>
            <button
              type="button"
              onClick={toggleVoice}
              className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
              disabled={!speechSupported && !voiceError}
              aria-pressed={isListening}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
            >
              <span className={styles.micGlyph} aria-hidden>{isListening ? '■' : '●'}</span>
              <span>{isListening ? 'Listening' : 'Voice'}</span>
            </button>

            <SubmitButton disabled={!draft.trim() || waitingReply} />
          </div>
        </div>
      </form>

      {voiceError && <p className={styles.voiceError}>{voiceError}</p>}
      <p className={styles.hint}>Type as much or as little as you need. Voice is optional. ⌘/Ctrl + Enter sends.</p>
    </div>
  )
}
