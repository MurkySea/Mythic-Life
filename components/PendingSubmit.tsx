'use client'

import { useFormStatus } from 'react-dom'

export function PendingCircleButton({
  title = 'Mark complete',
}: {
  title?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      className={`mt-0.5 w-6 h-6 rounded-full border-2 transition ${
        pending
          ? 'border-violet-500 bg-violet-600/40 cursor-wait'
          : 'border-zinc-600 hover:border-violet-500 hover:bg-violet-600/20'
      }`}
      aria-busy={pending}
    >
      {pending ? <span className="block w-2 h-2 mx-auto rounded-full bg-violet-300 animate-pulse" /> : null}
    </button>
  )
}

export function PendingSendButton({ label = 'Send' }: { label?: string }) {
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
      aria-busy={pending}
    >
      {pending ? '…' : label}
    </button>
  )
}
