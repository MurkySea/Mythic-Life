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
      className={`w-7 h-7 rounded-full border-[2.5px] flex items-center justify-center transition ${
        pending
          ? 'border-violet-400 bg-violet-600/50 cursor-wait'
          : 'border-zinc-500 hover:border-violet-400 hover:bg-violet-600/25 active:bg-violet-600/40'
      }`}
      aria-busy={pending}
    >
      {pending ? (
        <span className="block w-2.5 h-2.5 rounded-full bg-violet-200 animate-pulse" />
      ) : null}
    </button>
  )
}

export function PendingSendButton({ label = 'Send' }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition ${
        pending
          ? 'bg-violet-800 cursor-wait opacity-80'
          : 'bg-violet-600 hover:bg-violet-500 active:scale-95 shadow-lg shadow-violet-950/40'
      }`}
      aria-busy={pending}
    >
      {pending ? '…' : label}
    </button>
  )
}
