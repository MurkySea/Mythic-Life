import Link from 'next/link'
import {
  devUnlockAllCompanions,
  devBoostAllAffinity,
  hardResetGame,
  sendTestPush,
} from '../dev-actions'
import { COMPANION_DEFS } from '@/lib/companions'
import PushEnable from '@/components/PushEnable'

export const dynamic = 'force-dynamic'

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
          <h1 className="text-xl font-medium text-white tracking-tight">More</h1>
        </div>
      </div>

      <div className="space-y-4">
        <PushEnable />

        <div className="bg-amber-950/40 border-2 border-amber-600/50 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">
              Developer mode
            </p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Testing tools. Unlock opens the full roster. Boost raises affinity for scene tiers. Hard
              reset keeps tasks but wipes progression.
            </p>
          </div>

          <form action={devUnlockAllCompanions}>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-amber-600 text-black text-sm font-semibold hover:bg-amber-500 active:scale-[0.99] transition"
            >
              Unlock all companions
            </button>
          </form>

          <form action={devBoostAllAffinity}>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-zinc-900 border border-amber-700/60 text-amber-100 text-sm font-medium hover:border-amber-500 active:scale-[0.99] transition"
            >
              Boost all affinity → 20
            </button>
          </form>

          <form action={sendTestPush}>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-violet-900/80 border border-violet-600/60 text-violet-100 text-sm font-medium hover:border-violet-400 active:scale-[0.99] transition"
            >
              Send test push notification
            </button>
          </form>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Requires Enable companion notifications first + VAPID keys on Vercel. On iPhone use the
            Home Screen app icon.
          </p>

          <form action={hardResetGame}>
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-red-950/80 border border-red-700/60 text-red-200 text-sm font-medium hover:bg-red-900/60 active:scale-[0.99] transition"
            >
              Hard reset game
            </button>
          </form>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Hard reset: Seraphine only, affinity 1, empty inbox & gallery, skills cleared. Tasks stay.
          </p>
        </div>

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
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Roster size</span>
            <span className="text-white font-medium">{COMPANION_DEFS.length}</span>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Progression</p>
          <Link href="/skills" className="block text-violet-300 text-sm hover:text-violet-200">
            Skill tree →
          </Link>
          <Link href="/companions" className="block text-violet-300 text-sm hover:text-violet-200">
            Companions roster →
          </Link>
          <Link href="/companion-profile" className="block text-violet-300 text-sm hover:text-violet-200">
            Party profiles →
          </Link>
          <Link href="/messages" className="block text-violet-300 text-sm hover:text-violet-200">
            Message inbox →
          </Link>
          <Link href="/gallery" className="block text-violet-300 text-sm hover:text-violet-200">
            Scene gallery →
          </Link>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Supabase SQL (one-time)</p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Run in Supabase → SQL Editor if push subscribe fails:
          </p>
          <pre className="text-[10px] text-zinc-400 bg-zinc-950 rounded-xl p-3 overflow-x-auto leading-relaxed">{`create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz default now()
);
`}</pre>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed px-1 pt-2">
          Skills level from task domains. Companions unlock on skill milestones. Push uses Web Push +
          Home Screen on iPhone.
        </p>
      </div>
    </main>
  )
}
