import Link from 'next/link'
import {
  devUnlockAllCompanions,
  devBoostAllAffinity,
  hardResetGame,
  sendTestPush,
} from '../dev-actions'
import {
  actionEnterVacation,
  actionEnterRecovery,
  actionExitRestMode,
  actionAdvanceDay,
} from '../mode-actions'
import { COMPANION_DEFS } from '@/lib/companions'
import { loadPlayerState } from '@/lib/player-state'
import PushEnable from '@/components/PushEnable'

export const dynamic = 'force-dynamic'

function modeLabel(mode: string) {
  if (mode === 'vacation') return 'Vacation'
  if (mode === 'recovery') return 'Recovery'
  if (mode === 'ramp') return 'Ramp (returning)'
  return 'Normal'
}

function modeColor(mode: string) {
  if (mode === 'vacation') return 'text-emerald-300'
  if (mode === 'recovery') return 'text-sky-300'
  if (mode === 'ramp') return 'text-amber-300'
  return 'text-zinc-300'
}

export default async function SettingsPage() {
  const { mode, party } = await loadPlayerState()
  const isResting = mode.mode === 'vacation' || mode.mode === 'recovery'

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
        {/* ── Vacation / Rest Mode ── */}
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">
              Rest Mode
            </p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Vacation freezes Rhythm penalties, stops Shadow Debt accrual, and protects Companion
              Trust. Recovery is the same protection without the full Rested Buff.
            </p>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <span className="text-sm text-zinc-400">Current</span>
            <span className={`text-sm font-medium ${modeColor(mode.mode)}`}>
              {modeLabel(mode.mode)}
              {mode.consecutiveRestDays > 0 && (
                <span className="text-zinc-500 font-normal"> · {mode.consecutiveRestDays}d</span>
              )}
            </span>
          </div>

          {mode.hasRestedBuff && (
            <p className="text-xs text-amber-300/90">
              Rested Buff active — {mode.restedBuffDaysRemaining} day
              {mode.restedBuffDaysRemaining === 1 ? '' : 's'} remaining (+25% tokens)
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {!isResting && mode.mode !== 'ramp' && (
              <>
                <form action={actionEnterVacation}>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-600 active:scale-[0.99] transition"
                  >
                    Start Vacation
                  </button>
                </form>
                <form action={actionEnterRecovery}>
                  <button
                    type="submit"iguratively className="w-full py-3 rounded-xl bg-sky-900/80 border border-sky-700/50 text-sky-100 text-sm font-medium hover:border-sky-500 active:scale-[0.99] transition"
                  >
                    Recovery Day
                  </button>
                </form>
              </>
            )}

            {isResting && (
              <form action={actionExitRestMode} className="col-span-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-medium hover:border-zinc-500 active:scale-[0.99] transition"
                >
                  End Rest → Ramp
                </button>
              </form>
            )}

            {mode.mode === 'ramp' && (
              <p className="col-span-2 text-xs text-amber-200/80 text-center py-1">
                Soft re-entry window. Pressure returns gradually.
              </p>
            )}
          </div>

          <form action={actionAdvanceDay}>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-500 text-xs hover:text-zinc-300 transition"
            >
              Advance day (testing)
            </button>
          </form>
        </div>

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
          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-sm">Active party</span>
            <span className="text-white font-medium">
              {party.members.length} / 5{party.locked ? ' 🔒' : ''}
            </span>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">Progression</p>
          <Link href="/places" className="block text-violet-300 text-sm hover:text-violet-200">
            Places (life signal) →
          </Link>
          <Link href="/skills" className="block text-violet-300 text-sm hover:text-violet-200">
            Skill tree →
          </Link>
          <Link href="/companions" className="block text-violet-300 text-sm hover:text-violet-200">
            Companions & Active Party →
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
            Run in Supabase → SQL Editor if tables are missing:
          </p>
          <pre className="text-[10px] text-zinc-400 bg-zinc-950 rounded-xl p-3 overflow-x-auto leading-relaxed">{`create table if not exists player_state (
  id text primary key default 'main',
  mode_state jsonb not null default '{"mode":"normal","startedAt":null,"endsAt":null,"consecutiveRestDays":0,"hasRestedBuff":false,"restedBuffDaysRemaining":0}'::jsonb,
  party_state jsonb not null default '{"members":[],"locked":false}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz default now()
);

create table if not exists scheduled_outreach (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  companion_slug text not null,
  send_after timestamptz not null,
  payload jsonb default '{}'::jsonb,
  bypass_cap boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists push_log (
  id uuid primary key default gen_random_uuid(),
  kind text,
  companion_slug text,
  sent_at timestamptz default now()
);

create table if not exists conversation_reads (
  companion_slug text primary key,
  last_read_at timestamptz not null default now()
);

create table if not exists geo_events (
  id uuid primary key default gen_random_uuid(),
  place_id text not null,
  event text not null,
  source text default 'manual',
  lat double precision,
  lng double precision,
  occurred_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists geo_events_occurred_idx
  on geo_events (occurred_at desc);
`}</pre>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed px-1 pt-2">
          Skills level from task domains. Companions unlock on skill milestones. Outreach + chat
          replies can push. Inbox shows unread with a blue dot. Places feed life signal for
          companions and Rhythm.
        </p>
      </div>
    </main>
  )
}
