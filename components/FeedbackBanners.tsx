'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { FeedbackPayload } from '@/lib/feedback'

export default function FeedbackBanners({ feedback }: { feedback: FeedbackPayload }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3200)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className="space-y-2 relative">
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute -top-1 right-0 z-10 w-7 h-7 rounded-full bg-zinc-900/90 border border-zinc-700 text-zinc-400 hover:text-white text-sm flex items-center justify-center"
        aria-label="Dismiss"
      >
        ×
      </button>

      {(feedback.unlocked || []).map((u) => (
        <div
          key={u.slug}
          className="rounded-2xl border border-amber-600/40 bg-amber-950/30 p-3 pr-9"
        >
          <p className="text-amber-200 text-sm font-medium">
            {u.emoji} {u.name} joined your party
          </p>
          <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{u.line}</p>
          <Link
            href={`/messages?c=${u.slug}`}
            className="inline-block mt-1.5 text-xs text-amber-300/90 hover:text-amber-200"
          >
            Speak with them →
          </Link>
        </div>
      ))}

      <div className="rounded-2xl border border-violet-700/40 bg-violet-950/30 p-3 pr-9">
        <p className="text-[11px] uppercase tracking-wider text-violet-400/80 mb-1.5">Gains</p>
        <div className="flex flex-wrap gap-1.5">
          {(feedback.skillGains || []).map((g) => (
            <span
              key={g.skill}
              className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-violet-200 border border-violet-800/40"
            >
              +{g.xp} {g.label} · Lv {g.level}
            </span>
          ))}
          {feedback.bondXp > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-fuchsia-200 border border-fuchsia-800/40">
              +{feedback.bondXp} bond · {feedback.companionName}
            </span>
          )}
          {(feedback.streak || 0) >= 2 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-900 text-amber-200 border border-amber-800/40">
              {feedback.streak} day streak
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
