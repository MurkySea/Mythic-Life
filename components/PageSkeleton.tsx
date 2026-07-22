/** Instant shell while a route's server data loads */
export default function PageSkeleton({
  title = 'Loading',
  rows = 4,
}: {
  title?: string
  rows?: number
}) {
  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen animate-pulse">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800" />
        <div className="space-y-2 flex-1">
          <div className="h-2.5 w-16 rounded bg-zinc-800" />
          <div className="h-5 w-28 rounded bg-zinc-800" />
        </div>
      </div>
      <p className="sr-only">{title}</p>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <div className="h-4 w-2/3 rounded bg-zinc-800" />
            <div className="h-3 w-full rounded bg-zinc-800/80" />
            <div className="h-3 w-4/5 rounded bg-zinc-800/60" />
          </div>
        ))}
      </div>
    </main>
  )
}
