'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ResponseChoice } from '@/lib/engines/relationship'
import { isCheckInMessage } from '@/lib/engines/relationship-wire'

const CHOICES: {
  id: ResponseChoice
  label: string
  hint: string
}[] = [
  {
    id: 'honest',
    label: 'Honest',
    hint: 'Tell the truth',
  },
  {
    id: 'ask_support',
    label: 'Ask for support',
    hint: 'Let her in',
  },
  {
    id: 'push_through',
    label: 'Push through',
    hint: 'Stay strong',
  },
  {
    id: 'deflect',
    label: "I'm fine",
    hint: 'Keep the wall',
  },
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
  /** Parent already thinks last message is from companion */
  visible: boolean
  /** Last companion message text — used to gate check-in style only */
  lastCompanionContent?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)

  // Only show the four answers when the last line is a check-in / concern
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
        // Clear the note after she starts writing / page refreshes
        setTimeout(() => setNote(null), 6000)
      }
      router.refresh()
    })
  }

  return (
    <div className="px-4 pb-2">
      {note ? (
        <p className="text-[12px] text-violet-300/90 mb-2 px-0.5 leading-snug">
          {note}
        </p>
      ) : (
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 px-0.5">
          How do you answer?
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={pending}
            onClick={() => onPick(c.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition active:scale-95 ${
              pending
                ? 'border-zinc-800 text-zinc-600 cursor-wait'
                : 'border-zinc-700 bg-zinc-900/90 text-zinc-200 hover:border-violet-500/50 hover:text-violet-200'
            }`}
            title={c.hint}
          >
            {c.label}
          </button>
        ))}
      </div>
      {pending && (
        <p className="text-[11px] text-zinc-500 mt-2 animate-pulse">Sending…</p>
      )}
    </div>
  )
}
