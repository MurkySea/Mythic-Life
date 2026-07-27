import Link from 'next/link'

export function StandingTabs({ active }: { active: 'standing' | 'health' }) {
  const base =
    'flex-1 text-center text-xs py-2 rounded-lg border transition'
  const on = 'border-violet-700/50 bg-violet-950/40 text-violet-200'
  const off = 'border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300'

  return (
    <div className="flex gap-2 mb-6">
      <Link
        href="/standing"
        className={`${base} ${active === 'standing' ? on : off}`}
      >
        Standing
      </Link>
      <Link
        href="/standing/health"
        className={`${base} ${active === 'health' ? on : off}`}
      >
        Health
      </Link>
    </div>
  )
}
