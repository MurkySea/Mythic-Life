import { unlockAction, logoutAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; logged_out?: string }>
}) {
  const params = await searchParams
  const next = params.next && params.next.startsWith('/') ? params.next : '/'
  const errored = params.error === '1'
  const loggedOut = params.logged_out === '1'

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-zinc-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-violet-400/80">Mythic Life</p>
          <h1 className="text-2xl font-medium text-white tracking-tight">Sealed realm</h1>
          <p className="text-sm text-zinc-500">Enter the gate password to continue.</p>
        </div>

        {errored && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200 text-center">
            Wrong password.
          </div>
        )}
        {loggedOut && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400 text-center">
            Signed out. Enter the password again when ready.
          </div>
        )}

        <form action={unlockAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="sr-only">Password</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              placeholder="Gate password"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-600"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 transition"
          >
            Unlock
          </button>
        </form>

        <form action={logoutAction} className="text-center">
          <button type="submit" className="text-xs text-zinc-600 hover:text-zinc-400 transition">
            Clear gate cookie
          </button>
        </form>
      </div>
    </main>
  )
}
