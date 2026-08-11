'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTaskAction } from '@/app/task-actions'

export default function TaskActions({ taskId, title }: { taskId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function removeTask() {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return
    setError(null)
    startTransition(async () => {
      const result = await deleteTaskAction(taskId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`Actions for ${title}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 min-w-11 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 text-xl leading-none text-zinc-400 hover:border-zinc-600 hover:text-white"
      >
        ···
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-36 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
          <Link
            href={`/tasks/${taskId}/edit`}
            className="block px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-900"
            onClick={() => setOpen(false)}
          >
            Edit
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={removeTask}
            className="block w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-950/40 disabled:opacity-50"
          >
            {pending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
      {error && <p className="absolute right-0 top-full z-40 mt-2 w-52 rounded-lg border border-red-900 bg-red-950 p-2 text-xs text-red-200">{error}</p>}
    </div>
  )
}
