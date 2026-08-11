'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MythicIcon } from '@/components/MythicIcons'
import type { HabitLogRow, HabitRow } from '@/lib/habits'
import { setHabitOutcomeAction } from './outcome-actions'
import styles from './habit-outcome-panel.module.css'

type HabitOutcome = 'completed' | 'missed' | null

type OutcomeAwareLog = HabitLogRow & {
  outcome?: HabitOutcome
}

type Props = {
  habits: HabitRow[]
  logs: HabitLogRow[]
  today: string
}

function resolveOutcome(log: OutcomeAwareLog | null): HabitOutcome {
  if (!log) return null
  if (log.outcome === 'missed') return 'missed'
  if (log.completed || log.outcome === 'completed') return 'completed'
  return null
}

export default function HabitOutcomePanel({ habits, logs, today }: Props) {
  const router = useRouter()
  const [pendingHabitId, setPendingHabitId] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const logsByHabit = useMemo(
    () => new Map(logs.filter((log) => log.logged_date === today).map((log) => [log.habit_id, log as OutcomeAwareLog])),
    [logs, today]
  )

  function changeOutcome(habit: HabitRow, outcome: 'missed' | 'unlogged') {
    setPendingHabitId(habit.id)
    setNotice(null)
    startTransition(async () => {
      const result = await setHabitOutcomeAction(habit.id, outcome)
      setPendingHabitId('')
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      setNotice({
        tone: 'success',
        text: outcome === 'missed'
          ? `${habit.title} marked missed. Showing up honestly still counts.`
          : `${habit.title} returned to open for today.`,
      })
      router.refresh()
    })
  }

  if (habits.length === 0) return null

  return (
    <section className={styles.panel} aria-labelledby="habit-outcomes-title">
      <div className={styles.header}>
        <div>
          <p>Today&apos;s status</p>
          <h2 id="habit-outcomes-title">Resolve the day honestly</h2>
        </div>
        <span>Open ≠ missed</span>
      </div>
      <p className={styles.explainer}>
        A habit stays open until you decide the outcome. Marking it missed records a real setback instead of making an unlogged day look the same.
      </p>

      {notice && (
        <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <MythicIcon name={notice.tone === 'error' ? 'notifications' : 'spark'} size={16} />
          <span>{notice.text}</span>
        </div>
      )}

      <div className={styles.list}>
        {habits.map((habit) => {
          const outcome = resolveOutcome(logsByHabit.get(habit.id) || null)
          const pending = isPending && pendingHabitId === habit.id
          return (
            <article key={habit.id} className={`${styles.row} ${outcome === 'missed' ? styles.missed : outcome === 'completed' ? styles.completed : ''}`}>
              <span className={styles.icon} aria-hidden><MythicIcon name="training" size={17} /></span>
              <div className={styles.copy}>
                <strong>{habit.title}</strong>
                <span>{outcome === 'completed' ? 'Accomplished' : outcome === 'missed' ? 'Missed' : 'Open'}</span>
              </div>
              {outcome === 'missed' ? (
                <button type="button" disabled={pending} onClick={() => changeOutcome(habit, 'unlogged')}>
                  {pending ? 'Saving…' : 'Clear miss'}
                </button>
              ) : (
                <button type="button" className={styles.missButton} disabled={pending} onClick={() => changeOutcome(habit, 'missed')}>
                  {pending ? 'Saving…' : 'Mark missed'}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
