import Link from 'next/link'
import { PLACE_LIST } from '@/lib/engines/places'
import { actionGeoCheckIn } from '../geo-actions'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

async function recentEvents() {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('geo_events')
      .select('place_id, event, source, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(12)
    return data || []
  } catch {
    return []
  }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default async function PlacesPage() {
  const recent = await recentEvents()

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
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Life signal</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Places</h1>
        </div>
      </div>

      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
        Tap when you arrive or leave. iOS Shortcuts can POST the same events to{' '}
        <code className="text-zinc-300 text-xs">/api/geo</code> automatically.
      </p>

      <div className="space-y-3 mb-10">
        {PLACE_LIST.map((p) => (
          <div
            key={p.id}
            className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{p.emoji}</span>
              <div>
                <p className="text-white font-medium">{p.label}</p>
                <p className="text-[11px] text-zinc-500">{p.vibe}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={actionGeoCheckIn} className="flex-1">
                <input type="hidden" name="place" value={p.id} />
                <input type="hidden" name="event" value="arrive" />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-800/80 border border-emerald-700/50 text-emerald-100 text-sm font-medium hover:bg-emerald-700 active:scale-[0.99] transition"
                >
                  Arrive
                </button>
              </form>
              {p.trackLeave && (
                <form action={actionGeoCheckIn} className="flex-1">
                  <input type="hidden" name="place" value={p.id} />
                  <input type="hidden" name="event" value="leave" />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-medium hover:border-zinc-500 active:scale-[0.99] transition"
                  >
                    Leave
                  </button>
                </form>
              )}
              <form action={actionGeoCheckIn} className="flex-1">
                <input type="hidden" name="place" value={p.id} />
                <input type="hidden" name="event" value="checkin" />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-violet-900/60 border border-violet-700/40 text-violet-100 text-sm font-medium hover:border-violet-500 active:scale-[0.99] transition"
                >
                  Here
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Recent</p>
        {recent.length === 0 ? (
          <p className="text-xs text-zinc-600">No events yet. Tap above or wire a Shortcut.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r, i) => (
              <li
                key={i}
                className="flex justify-between text-sm gap-3"
              >
                <span className="text-zinc-300">
                  <span className="text-zinc-500">{r.event}</span>{' '}
                  {r.place_id}
                </span>
                <span className="text-zinc-600 text-xs shrink-0">
                  {fmtTime(r.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">Shortcuts</p>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Automation → Arrive at [Location] → Get Contents of URL:
        </p>
        <pre className="text-[10px] text-zinc-400 bg-zinc-900 rounded-xl p-3 overflow-x-auto">{`POST https://YOUR_DOMAIN/api/geo
Authorization: Bearer YOUR_GEO_SECRET
Content-Type: application/json

{"place":"home","event":"arrive","source":"shortcut"}`}</pre>
        <p className="text-[10px] text-zinc-600">
          Set <code className="text-zinc-500">GEO_SECRET</code> (or reuse{' '}
          <code className="text-zinc-500">CRON_SECRET</code>) in Vercel env.
        </p>
      </div>

      <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
          Supabase (one-time)
        </p>
        <pre className="text-[10px] text-zinc-400 overflow-x-auto leading-relaxed">{`create table if not exists geo_events (
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
    </main>
  )
}
