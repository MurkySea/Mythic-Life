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
    <div className="space-y-2.5 relative">
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="absolute -top-1 right-1 z-10 w-8 h-8 rounded-full bg-[#121218] border border-[#2a2a35] text-zinc-400 hover:text-white text-base flex items-center justify-center"
        aria-label="Dismiss"
      >
        ×
      </button>

      {(feedback.unlocked || []).map((u) => (
        <div
          key={u.slug}
          className="rounded-[1.15rem] border border-amber-600/35 bg-amber-950/25 p-4 pr-10 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
        >
          <p className="text-amber-200 text-sm font-bold tracking-tight">
            {u.emoji} {u.name} joined your party
          </p>
          <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">{u.line}</p>
          <Link
            href={`/messages?c=${u.slug}`}
            className="inline-block mt-2 text-xs font-semibold text-amber-300/90 hover:text-amber-200"
          >
            Speak with them →
          </Link>
        </div>
      ))}

      <div className="rounded-[1.15rem] border border-violet-600/35 bg-violet-950/25 p-4 pr-10 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-violet-400/90 mb-2">Gains</p>
        <div className="flex flex-wrap gap-1.5">
          {(feedback.skillGains || []).map((g) => (
            <span
              key={g.skill}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0c0c10] text-violet-200 border border-violet-700/40"
            >
              +{g.xp} {g.label} · Lv {g.level}
            </span>
          ))}
          {feedback.bondXp > 0 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0c0c10] text-fuchsia-200 border border-fuchsia-700/40">
              +{feedback.bondXp} bond · {feedback.companionName}
            </span>
          )}
          {(feedback.streak || 0) >= 2 && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0c0c10] text-amber-200 border border-amber-700/40">
              {feedback.streak} day streak
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
