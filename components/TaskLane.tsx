import { completeTask } from '@/app/complete-task'
import { PendingCircleButton } from '@/components/PendingSubmit'
import { QuestRow } from '@/components/FantasyFrame'
import type { TaskRow } from '@/lib/task-lanes'

function formatAnchor(time: string | null | undefined): string | null {
  if (!time || typeof time !== 'string') return null
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return time
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${min} ${ampm}`
}

export default function TaskLane({
  label,
  hint,
  tasks,
  empty,
  accent = 'zinc',
}: {
  label: string
  hint?: string
  tasks: TaskRow[]
  empty?: string
  accent?: 'gold' | 'violet' | 'zinc'
}) {
  const kicker =
    accent === 'gold'
      ? 'text-amber-400/90'
      : accent === 'violet'
        ? 'text-violet-400/90'
        : 'text-zinc-500'

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1 gap-2">
        <h2 className={`text-[11px] font-bold tracking-[0.14em] uppercase ${kicker}`}>
          {label}
        </h2>
        {hint && <span className="text-[10px] text-zinc-600 tabular-nums">{hint}</span>}
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((task) => {
            const timeLabel = formatAnchor(task.anchor_time)
            return (
              <QuestRow key={task.id}>
                <form action={completeTask} className="shrink-0">
                  <input type="hidden" name="id" value={task.id} />
                  <PendingCircleButton />
                </form>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="quest-row-title truncate">{task.title}</p>
                    {timeLabel && <span className="quest-row-time">{timeLabel}</span>}
                  </div>
                  {(task.streak_count || 0) >= 2 && (
                    <p className="quest-row-streak">{task.streak_count} day streak</p>
                  )}
                </div>
              </QuestRow>
            )
          })}
        </div>
      ) : (
        empty && (
          <div className="rounded-xl border border-dashed border-zinc-800/80 px-4 py-4">
            <p className="text-xs text-zinc-600 text-center">{empty}</p>
          </div>
        )
      )}
    </section>
  )
}
