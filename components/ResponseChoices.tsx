'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ResponseChoice } from '@/lib/engines/relationship'
import { isCheckInMessage } from '@/lib/engines/relationship-wire'
import { companionTone } from '@/lib/companion-tone'
import styles from './response-choices.module.css'

const CHOICES: {
  id: ResponseChoice
  label: string
  hint: string
}[] = [
  { id: 'honest', label: 'Honest', hint: 'Tell the truth' },
  { id: 'ask_support', label: 'Ask for support', hint: 'Let her in' },
  { id: 'push_through', label: 'Push through', hint: 'Stay strong' },
  { id: 'deflect', label: "I'm fine", hint: 'Keep the wall' },
]

export type ResponseResult = {
  note?: string
  stage?: string
}

export default function ResponseChoices({
  companionSlug,
  action,
  visible,
  lastCompanionContent,
}: {
  companionSlug: string
  action: (formData: FormData) => Promise<ResponseResult | void>
  visible: boolean
  lastCompanionContent?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const tone = companionTone(companionSlug)

  const isCheckIn = isCheckInMessage(lastCompanionContent)
  if (!visible || !isCheckIn) return null

  function onPick(choice: ResponseChoice) {
    if (pending) return
    const fd = new FormData()
    fd.set('choice', choice)
    fd.set('companion_slug', companionSlug)
    startTransition(async () => {
      const result = await action(fd)
      if (result?.note) {
        setNote(result.note)
        setTimeout(() => setNote(null), 6000)
      }
      router.refresh()
    })
  }

  return (
    <div className={styles.choices} data-tone={tone}>
      {note ? (
        <p className={styles.note}>{note}</p>
      ) : (
        <p className={styles.prompt}>How do you answer her?</p>
      )}
      <div className={styles.grid}>
        {CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            disabled={pending}
            onClick={() => onPick(choice.id)}
            className={styles.choice}
            title={choice.hint}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {pending && <p className={styles.pending}>Your answer crosses the chamber…</p>}
    </div>
  )
}
