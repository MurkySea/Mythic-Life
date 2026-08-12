'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MythicIcon } from '@/components/MythicIcons'
import type { HabitLogRow, HabitRow } from '@/lib/habits'
import { setHabitIntentAction } from './intent-actions'
import { setHabitOutcomeAction } from './outcome-actions'
import styles from './habit-outcome-panel.module.css'

type HabitOutcome = 'completed' | 'missed' | null
type HabitIntent = 'build' | 'avoid'

type OutcomeAwareLog = HabitLogRow & {
  outcome?: HabitOutcome
}

type IntentAwareHabit = HabitRow & {
  intent?: HabitIntent
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

function resolveIntent(habit: IntentAwareHabit): HabitIntent {
  return habit.intent === 'avoid' ? 'avoid' : 'build'
}

export default function HabitOutcomePanel({ habits, logs, today }: Props) {
  const router = useRouter()
  const [pendingKey, setPendingKey] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const logsByHabit = useMemo(
    () => new Map(logs.filter((log) => log.logged_date === today).map((log) => [log.habit_id, log as OutcomeAwareLog])),
    [logs, today]
  )
  const missedCount = useMemo(
    () => habits.filter((habit) => resolveOutcome(logsByHabit.get(habit.id) || null) === 'missed').length,
    [habits, logsByHabit]
  )
  const openCount = useMemo(
    () => habits.filter((habit) => resolveOutcome(logsByHabit.get(habit.id) || null) === null).length,
    [habits, logsByHabit]
  )

  function changeOutcome(habit: HabitRow, outcome: 'completed' | 'missed' | 'unlogged') {
    if (isPending) return
    setPendingKey(`outcome-${habit.id}`)
    setNotice(null)
    startTransition(async () => {
      const result = await setHabitOutcomeAction(habit.id, outcome)
      setPendingKey('')
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      setNotice({
        tone: 'success',
        text: outcome === 'completed'
          ? result.data?.reward_awarded
            ? `${habit.title} kept. +${result.data.xp_awarded} XP recorded.`
            : `${habit.title} kept.`
          : outcome === 'missed'
            ? `${habit.title} marked missed. Honest tracking is still showing up.`
            : `${habit.title} returned to open for today.`,
      })
      router.refresh()
    })
  }

  function changeIntent(habit: IntentAwareHabit, intent: HabitIntent) {
    if (isPending) return
    setPendingKey(`intent-${habit.id}`)
    setNotice(null)
    startTransition(async () => {
      const result = await setHabitIntentAction(habit.id, intent)
      setPendingKey('')
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error })
        return
      }
      setNotice({
        tone: 'success',
        text: intent === 'avoid'
          ? `${habit.title} is now an Avoid habit. Success means keeping the boundary.`
          : `${habit.title} is now a Build habit. Success comes from doing the practice.`,
      })
      router.refresh()
    })
  }

  if (habits.length === 0) return null

  return (
    <details className={styles.tray}>
      <summary className={styles.summary}>
        <span className={styles.summaryIcon} aria-hidden><MythicIcon name="training" size={18} /></span>
        <span className={styles.summaryCopy}>
          <strong>Today&apos;s outcomes</strong>
          <small>{missedCount > 0 ? `${missedCount} missed · ${openCount} open` : `${openCount} open`}</small>
        </span>
        <span className={styles.chevron} aria-hidden>⌃</span>
      </summary>

      <section className={styles.panel} aria-labelledby="habit-outcomes-title">
        <div className={styles.header}>
          <div>
            <p>Today&apos;s status</p>
            <h2 id="habit-outcomes-title">Resolve the day honestly</h2>
          </div>
          <span>Build or Avoid</span>
        </div>
        <p className={styles.explainer}>
          Build habits are won by doing the practice. Avoid habits are won by keeping a boundary. Open still means undecided, not failed.
        </p>

        {notice && (
          <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <MythicIcon name={notice.tone === 'error' ? 'notifications' : 'spark'} size={16} />
            <span>{notice.text}</span>
          </div>
        )}

        <div className={styles.list}>
          {habits.map((baseHabit) => {
            const habit = baseHabit as IntentAwareHabit
            const intent = resolveIntent(habit)
            const outcome = resolveOutcome(logsByHabit.get(habit.id) || null)
            const outcomePending = isPending && pendingKey === `outcome-${habit.id}`
            const intentPending = isPending && pendingKey === `intent-${habit.id}`
            return (
              <article key={habit.id} className={`${styles.row} ${outcome === 'missed' ? styles.missed : outcome === 'completed' ? styles.completed : ''}`}>
                <span className={styles.icon} aria-hidden><MythicIcon name={intent === 'avoid' ? 'streak' : 'training'} size={17} /></span>
                <div className={styles.copy}>
                  <strong>{habit.title}</strong>
                  <span>{outcome === 'completed' ? (intent === 'avoid' ? 'Kept' : 'Accomplished') : outcome === 'missed' ? 'Missed' : 'Open'}</span>
                  <div className={styles.intentSwitch} role="group" aria-label={`${habit.title} habit direction`}>
                    <button
                      type="button"
                      className={intent === 'build' ? styles.intentActive : ''}
                      disabled={isPending}
                      onClick={() => changeIntent(habit, 'build')}
                    >
                      {intentPending && intent !== 'build' ? 'Saving…' : 'Build'}
                    </button>
                    <button
                      type="button"
                      className={intent === 'avoid' ? styles.intentActive : ''}
                      disabled={isPending}
                      onClick={() => changeIntent(habit, 'avoid')}
                    >
                      {intentPending && intent !== 'avoid' ? 'Saving…' : 'Avoid'}
                    </button>
                  </div>
                </div>

                <div className={styles.outcomeActions}>
                  {intent === 'avoid' && outcome === null && (
                    <button type="button" className={styles.keepButton} disabled={isPending} onClick={() => changeOutcome(habit, 'completed')}>
                      {outcomePending ? 'Saving…' : 'Kept it'}
                    </button>
                  )}
                  {outcome === 'missed' ? (
                    <button type="button" disabled={isPending} onClick={() => changeOutcome(habit, 'unlogged')}>
                      {outcomePending ? 'Saving…' : 'Clear miss'}
                    </button>
                  ) : outcome !== 'completed' ? (
                    <button type="button" className={styles.missButton} disabled={isPending} onClick={() => changeOutcome(habit, 'missed')}>
                      {outcomePending ? 'Saving…' : 'Mark missed'}
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </details>
  )
}
