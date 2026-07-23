import Link from 'next/link'

export const dynamic = 'force-dynamic'

const ITEMS = [
  {
    href: '/',
    title: 'Today',
    blurb: 'What you’re focusing on right now.',
    icon: '⚔',
  },
  {
    href: '/mother-list',
    title: 'Master List',
    blurb: 'All tasks — add to Today, review, delete.',
    icon: '📜',
  },
  {
    href: '/task-generator',
    title: 'Task Generator',
    blurb: 'Build a task: domains, repeat, days, time.',
    icon: '✦',
  },
] as const

export default function TasksHubPage() {
  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="mb-8">
        <p className="text-zinc-500 text-xs tracking-wide uppercase">Tasks</p>
        <h1 className="text-2xl font-medium text-white tracking-tight">Menu</h1>
        <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
          Keep the list clean. Build complexity in the generator.
        </p>
      </div>

      <div className="space-y-3">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-4 hover:border-violet-700/50 hover:bg-zinc-900 transition"
          >
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-xl shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{item.title}</p>
              <p className="text-sm text-zinc-500 mt-0.5">{item.blurb}</p>
            </div>
            <span className="text-zinc-600">›</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
