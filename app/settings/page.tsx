import Link from 'next/link'

export default function SettingsPage() {
  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div>
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Mythic Life</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Player</p>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Name</span>
            <span className="text-white font-medium">Mark</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Timezone</span>
            <span className="text-white font-medium">America/Chicago</span>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Companions</p>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Task recognition</span>
            <span className="text-violet-300 text-sm">Occasional (~35%)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Quiet hours</span>
            <span className="text-zinc-500 text-sm">Coming soon</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Push notifications</span>
            <span className="text-zinc-500 text-sm">Coming soon</span>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Explore</p>
          <Link href="/companions" className="block text-violet-300 text-sm hover:text-violet-200">
            Companions roster →
          </Link>
          <Link href="/gallery" className="block text-violet-300 text-sm hover:text-violet-200">
            Scene gallery →
          </Link>
          <Link href="/companion-profile" className="block text-violet-300 text-sm hover:text-violet-200">
            Seraphine profile →
          </Link>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed px-1 pt-2">
          From your Notion roadmap: streaks, consistency bonuses, companion affinity domains, and
          occasional recognition are live. Full push notifications and multi-companion chat need
          backend scheduling next.
        </p>
      </div>
    </main>
  )
}
