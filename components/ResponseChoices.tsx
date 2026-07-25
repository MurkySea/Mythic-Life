'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ResponseChoice } from '@/lib/engines/relationship'

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

export default function ResponseChoices({
  companionSlug,
  action,
  visible,
}: {
  companionSlug: string
  action: (formData: FormData) => Promise<void>
  /** Only show when the last message is from the companion */
  visible: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (!visible) return null

  function onPick(choice: ResponseChoice) {
    if (pending) return
    const fd = new FormData()
    fd.set('choice', choice)
    fd.set('companion_slug', companionSlug)
    startTransition(async () => {
      await action(fd)
      router.refresh()
    })
  }

  return (
    <div className="px-4 pb-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2 px-0.5">
        How do you answer?
      </p>
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
