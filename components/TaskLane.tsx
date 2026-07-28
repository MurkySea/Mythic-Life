import { completeTask } from '@/app/complete-task'
import { PendingCircleButton } from '@/components/PendingSubmit'
import { MythicEmptyState, MythicSectionHeader } from '@/components/MythicSurface'
import type { TaskRow } from '@/lib/task-lanes'
import styles from './task-lane.module.css'

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

function taskTags(task: TaskRow): string[] {
  const domains = String(task.domains || task.domain || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (domains.length > 0) return domains

  const recurrence = String(task.recurrence || '').toLowerCase()
  if (recurrence === 'daily') return ['Daily contract']
  if (recurrence === 'weekly') return ['Weekly contract']
  return ['Quest']
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
  const sigil = accent === 'gold' ? '!' : accent === 'violet' ? '◇' : '↻'

  return (
    <section className={styles.lane}>
      <MythicSectionHeader title={label} hint={hint} sigil={sigil} />

      {tasks.length > 0 ? (
        <div className={styles.list}>
          {tasks.map((task) => {
            const timeLabel = formatAnchor(task.anchor_time)
            const tags = taskTags(task)

            return (
              <article key={task.id} className={`${styles.row} ${styles[accent]}`}>
                <form action={completeTask} className={styles.complete}>
                  <input type="hidden" name="id" value={task.id} />
                  <PendingCircleButton title={`Complete ${task.title}`} />
                </form>

                <div className={styles.copy}>
                  <div className={styles.titleRow}>
                    <p className={styles.title}>{task.title}</p>
                    {timeLabel && <span className={styles.time}>{timeLabel}</span>}
                  </div>
                  <div className={styles.meta}>
                    {tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                    {(task.streak_count || 0) >= 2 && (
                      <span className={styles.streak}>{task.streak_count} day streak</span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        empty && (
          <MythicEmptyState
            title={label === 'Routine' ? 'No repeatable contracts remain.' : 'This order board is clear.'}
            body={empty}
            mark={sigil}
          />
        )
      )}
    </section>
  )
}
