'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import { SKILLS, SKILL_LABELS } from '@/lib/skills'
import {
  HABIT_ICON_NAMES,
  HABIT_SUGGESTIONS,
  IMPULSE_CATEGORIES,
  IMPULSE_CATEGORY_LABELS,
  WEEKDAYS,
  addDateKey,
  calculateHabitAnalytics,
  calculateTrainingSummary,
  elapsedSessionSeconds,
  formatDuration,
  habitTargetLabel,
  isHabitIcon,
  isHabitScheduledOn,
  type HabitAnalytics,
  type HabitEventRow,
  type HabitLogRow,
  type HabitRow,
  type HabitSessionRow,
  type HabitTrackingType,
  type ImpulseCategory,
} from '@/lib/habits'
import {
  addSuggestedHabitAction,
  finishHabitTimerAction,
  pauseHabitTimerAction,
  recordHabitProgressAction,
  recordImpulseAction,
  resumeHabitTimerAction,
  saveHabitAction,
  setHabitActiveAction,
  startHabitTimerAction,
} from './actions'
import { setHabitIntentAction } from './intent-actions'
import styles from './habits.module.css'

type TrainingView = 'today' | 'progress' | 'manage'
type HabitIntent = 'build' | 'avoid'
type IntentAwareHabit = HabitRow & { intent?: HabitIntent }

type Props = {
  today: string
  habits: HabitRow[]
  logs: HabitLogRow[]
  sessions: HabitSessionRow[]
  events: HabitEventRow[]
  skillXp: Record<string, number>
}

type Notice = { tone: 'success' | 'error'; text: string } | null

const VIEW_LABELS: Array<{ id: TrainingView; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'progress', label: 'Progress' },
  { id: 'manage', label: 'Manage' },
]

function habitIcon(icon: string): MythicIconName {
  return isHabitIcon(icon) ? icon : 'training'
}

function trackingLabel(type: HabitTrackingType): string {
  return {
    check: 'Check',
    counter: 'Counter',
    timer: 'Timer',
    stopwatch: 'Stopwatch',
  }[type]
}

function resolveIntent(habit: IntentAwareHabit | null): HabitIntent {
  return habit?.intent === 'avoid' ? 'avoid' : 'build'
}

function dateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function scheduleLabel(habit: HabitRow): string {
  if (habit.frequency === 'daily') return 'Every day'
  return WEEKDAYS.filter((day) => habit.days_of_week.includes(day.value))
    .map((day) => day.short)
    .join(' · ')
}

function LiveElapsed({
  session,
  baseSeconds = 0,
}: {
  session: HabitSessionRow | null
  baseSeconds?: number
}) {
  const [now, setNow] = useState(() => session ? Date.parse(session.updated_at) : 0)

  useEffect(() => {
    if (session?.status !== 'running') return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [session?.status])

  return <>{formatDuration(baseSeconds + (session ? elapsedSessionSeconds(session, now) : 0))}</>
}

function HabitProgressCard({
  habit,
  log,
  session,
  pending,
  onProgress,
  onOpenTimer,
}: {
  habit: HabitRow
  log: HabitLogRow | null
  session: HabitSessionRow | null
  pending: boolean
  onProgress: () => void
  onOpenTimer: () => void
}) {
  const value = log?.value || 0
  const persistedDuration = log?.duration_seconds || 0
  const completed = Boolean(log?.completed)
  const timed = habit.tracking_type === 'timer' || habit.tracking_type === 'stopwatch'
  const target = habit.tracking_type === 'counter'
    ? Math.max(1, habit.target_value || 1)
    : Math.max(1, habit.target_seconds || 1)
  const numericProgress = habit.tracking_type === 'counter'
    ? value
    : habit.tracking_type === 'check'
      ? completed ? 1 : 0
      : persistedDuration + (session ? elapsedSessionSeconds(session, Date.parse(session.updated_at)) : 0)
  const percent = habit.tracking_type === 'stopwatch'
    ? completed ? 100 : 0
    : Math.min(100, Math.round((numericProgress / target) * 100))

  return (
    <article className={`${styles.habitCard} ${completed ? styles.habitComplete : ''}`}>
      <div className={styles.habitSigil} aria-hidden>
        <MythicIcon name={habitIcon(habit.icon)} size={21} />
      </div>
      <div className={styles.habitBody}>
        <div className={styles.habitTitleRow}>
          <div>
            <h3>{habit.title}</h3>
            <p>
              {completed ? 'Training recorded' : trackingLabel(habit.tracking_type)}
              {habit.skill_key ? ` · ${SKILL_LABELS[habit.skill_key]}` : ''}
            </p>
          </div>
          {habit.xp_reward > 0 && <span className={styles.xpPill}>+{habit.xp_reward} XP</span>}
        </div>

        <div className={styles.progressLine}>
          <strong>
            {habit.tracking_type === 'check' && (completed ? 'Complete' : 'Not yet trained')}
            {habit.tracking_type === 'counter' && `${value} / ${habit.target_value || 1} ${habit.target_unit || ''}`}
            {timed && (
              <>
                <LiveElapsed session={session} baseSeconds={persistedDuration} />
                {habit.tracking_type === 'timer' && ` / ${formatDuration(habit.target_seconds || 0)}`}
              </>
            )}
          </strong>
          <span>{habitTargetLabel(habit)}</span>
        </div>
        {habit.tracking_type !== 'stopwatch' && (
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label={`${habit.title} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      {timed ? (
        <button
          type="button"
          className={styles.cardAction}
          onClick={onOpenTimer}
          aria-label={`Open ${habit.title} ${habit.tracking_type}`}
        >
          {session ? (session.status === 'paused' ? 'Resume' : 'Open') : 'Begin'}
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.cardAction} ${completed && habit.tracking_type === 'check' ? styles.actionDone : ''}`}
          disabled={pending || (completed && habit.tracking_type === 'check')}
          onClick={onProgress}
          aria-label={habit.tracking_type === 'check' ? `Complete ${habit.title}` : `Add one ${habit.title} repetition`}
        >
          {pending ? 'Saving…' : habit.tracking_type === 'check' ? (completed ? 'Done' : 'Complete') : '+1'}
        </button>
      )}
    </article>
  )
}

function TimerFocus({
  habit,
  todayLog,
  initialSession,
  onClose,
  onNotice,
}: {
  habit: HabitRow
  todayLog: HabitLogRow | null
  initialSession: HabitSessionRow | null
  onClose: () => void
  onNotice: (notice: Notice) => void
}) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [now, setNow] = useState(() => initialSession ? Date.parse(initialSession.updated_at) : 0)
  const [error, setError] = useState('')
  const [completion, setCompletion] = useState<{ duration: number; complete: boolean; xp: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const closeRef = useRef<HTMLButtonElement>(null)
  const lockRef = useRef(false)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (session?.status !== 'running') return
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [session?.status])

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isPending, onClose])

  const sessionSeconds = session ? elapsedSessionSeconds(session, now) : 0
  const totalSeconds = (todayLog?.duration_seconds || 0) + sessionSeconds
  const target = habit.target_seconds || 0
  const targetReached = habit.tracking_type === 'timer' && totalSeconds >= target

  function run(operation: () => Promise<void>) {
    if (lockRef.current) return
    lockRef.current = true
    setError('')
    startTransition(async () => {
      try {
        await operation()
      } finally {
        lockRef.current = false
      }
    })
  }

  function start() {
    run(async () => {
      const result = await startHabitTimerAction(habit.id)
      if (!result.ok) return setError(result.error)
      setSession(result.data)
      setNow(Date.parse(result.data.updated_at))
    })
  }

  function pause() {
    if (!session) return
    run(async () => {
      const result = await pauseHabitTimerAction(session.id)
      if (!result.ok) return setError(result.error)
      setSession(result.data)
    })
  }

  function resume() {
    if (!session) return
    run(async () => {
      const result = await resumeHabitTimerAction(session.id)
      if (!result.ok) return setError(result.error)
      setSession(result.data)
      setNow(Date.parse(result.data.updated_at))
    })
  }

  function finish() {
    if (!session) return
    run(async () => {
      const result = await finishHabitTimerAction(session.id, crypto.randomUUID())
      if (!result.ok) return setError(result.error)
      setCompletion({
        duration: result.data.final_duration_seconds,
        complete: result.data.is_completed,
        xp: result.data.xp_awarded,
      })
      setSession(null)
      onNotice({
        tone: 'success',
        text: result.data.is_completed
          ? `${habit.title} recorded. The practice remains yours.`
          : `${habit.title} time recorded. You can return again today.`,
      })
      router.refresh()
    })
  }

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section
        className={styles.timerDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="timer-title"
        aria-describedby="timer-status"
      >
        <button ref={closeRef} type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close focused timer">×</button>
        <div className={styles.timerSigil} aria-hidden><MythicIcon name={habitIcon(habit.icon)} size={27} /></div>
        <p className={styles.timerEyebrow}>Focused training</p>
        <h2 id="timer-title">{habit.title}</h2>

        {completion ? (
          <div className={styles.completionTreatment} aria-live="polite">
            <MythicIcon name="spark" size={30} />
            <strong>{formatDuration(completion.duration)} recorded</strong>
            <p>{completion.complete ? 'The repetition is written into your training record.' : 'Time accumulated. Nothing was erased.'}</p>
            {completion.xp > 0 && <span>+{completion.xp} linked skill XP</span>}
            <button type="button" className={styles.primaryButton} onClick={onClose}>Return to the Grounds</button>
          </div>
        ) : (
          <>
            <div className={styles.timerClock} aria-live="off" aria-label={`${formatDuration(totalSeconds)} elapsed`}>
              <LiveElapsed session={session} baseSeconds={todayLog?.duration_seconds || 0} />
              {habit.tracking_type === 'timer' && <small>/ {formatDuration(target)}</small>}
            </div>
            <p id="timer-status" className={styles.timerStatus} aria-live="polite">
              {!session && 'Ready when you are.'}
              {session?.status === 'running' && (targetReached ? 'Target reached. Continue as long as the practice is useful.' : 'Training in progress.')}
              {session?.status === 'paused' && 'Paused. The time already earned is safe.'}
            </p>
            {error && <p className={styles.formError} role="alert">{error}</p>}
            <div className={styles.timerControls}>
              {!session && <button type="button" className={styles.primaryButton} disabled={isPending} onClick={start}>Begin</button>}
              {session?.status === 'running' && <button type="button" className={styles.secondaryButton} disabled={isPending} onClick={pause}>Pause</button>}
              {session?.status === 'paused' && <button type="button" className={styles.primaryButton} disabled={isPending} onClick={resume}>Resume</button>}
              {session && <button type="button" className={styles.finishButton} disabled={isPending} onClick={finish}>Finish</button>}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function ImpulsePractice({
  habit,
  events,
  today,
  pending,
  onRecord,
  onSetup,
}: {
  habit: HabitRow | null
  events: HabitEventRow[]
  today: string
  pending: boolean
  onRecord: (category: ImpulseCategory | null) => void
  onSetup: () => void
}) {
  const [category, setCategory] = useState<ImpulseCategory | ''>('')
  const habitEvents = habit ? events.filter((event) => event.habit_id === habit.id) : []
  const week = habitEvents.filter((event) => event.logged_date >= addDateKey(today, -6)).length
  const month = habitEvents.filter((event) => event.logged_date >= addDateKey(today, -29)).length
  const trend = [3, 2, 1, 0].map((window) => {
    const end = addDateKey(today, -(window * 7))
    const start = addDateKey(end, -6)
    return {
      label: window === 0 ? 'Now' : `${window}w`,
      count: habitEvents.filter((event) => event.logged_date >= start && event.logged_date <= end).length,
    }
  })
  const trendMax = Math.max(1, ...trend.map((point) => point.count))

  return (
    <section className={styles.impulseCard} aria-labelledby="impulse-title">
      <div className={styles.impulseIcon} aria-hidden><MythicIcon name="streak" size={22} /></div>
      <div className={styles.impulseCopy}>
        <p className={styles.sectionEyebrow}>Quick practice</p>
        <h2 id="impulse-title">Resisted an Impulse</h2>
        <p>I experienced an impulse without immediately obeying it.</p>
        {habit && <><div className={styles.impulseStats}><span><strong>{week}</strong> this week</span><span><strong>{month}</strong> this month</span></div><div className={styles.impulseTrend} aria-label="Impulse restraint count over four recent weeks">{trend.map((point) => <span key={point.label}><i style={{ height: `${Math.max(7, (point.count / trendMax) * 100)}%` }} /><small>{point.label} · {point.count}</small></span>)}</div></>}
      </div>
      {habit ? (
        <div className={styles.impulseAction}>
          <label htmlFor="impulse-category">Category <span>optional</span></label>
          <select id="impulse-category" value={category} onChange={(event) => setCategory(event.target.value as ImpulseCategory | '')}>
            <option value="">No category</option>
            {IMPULSE_CATEGORIES.map((item) => <option key={item} value={item}>{IMPULSE_CATEGORY_LABELS[item]}</option>)}
          </select>
          <button type="button" disabled={pending} onClick={() => onRecord(category || null)}>{pending ? 'Recording…' : 'Record restraint'}</button>
        </div>
      ) : (
        <button type="button" className={styles.setupButton} disabled={pending} onClick={onSetup}>{pending ? 'Adding…' : 'Add this training'}</button>
      )}
    </section>
  )
}

function TrendBars({ analytics, title }: { analytics: HabitAnalytics; title: string }) {
  return (
    <div className={styles.trend} aria-label={`${title} recent four-week trend`}>
      {analytics.trend.map((point) => (
        <div className={styles.trendPoint} key={point.start}>
          <div className={styles.trendBar}><span style={{ height: `${point.consistency}%` }} /></div>
          <small>{point.label}</small>
          <span className={styles.srOnly}>{point.consistency}% consistency</span>
        </div>
      ))}
    </div>
  )
}

function ProgressRecord({ habit, analytics }: { habit: HabitRow; analytics: HabitAnalytics }) {
  return (
    <article className={styles.recordCard}>
      <div className={styles.recordHeader}>
        <span className={styles.recordIcon} aria-hidden><MythicIcon name={habitIcon(habit.icon)} size={19} /></span>
        <div><h3>{habit.title}</h3><p>Training record</p></div>
        {!habit.is_active && <span className={styles.archivedPill}>Archived</span>}
      </div>
      <div className={styles.recordStats}>
        <div><strong>{analytics.last7.completed} / {analytics.last7.scheduled}</strong><span>Last 7 days</span></div>
        <div><strong>{analytics.last30.consistency}%</strong><span>30-day consistency</span></div>
        <div><strong>{analytics.totalSessions}</strong><span>Sessions</span></div>
        {habit.tracking_type === 'counter' && <div><strong>{analytics.totalRepetitions}</strong><span>Total repetitions</span></div>}
        {(habit.tracking_type === 'timer' || habit.tracking_type === 'stopwatch') && <div><strong>{formatDuration(analytics.totalDurationSeconds, true)}</strong><span>Total practice</span></div>}
        {(habit.tracking_type === 'check') && <div><strong>{analytics.totalCompletions}</strong><span>Total completions</span></div>}
      </div>
      <TrendBars analytics={analytics} title={habit.title} />
    </article>
  )
}

function HabitForm({ habit, onClose }: { habit: HabitRow | null; onClose: () => void }) {
  const router = useRouter()
  const intentHabit = habit as IntentAwareHabit | null
  const [intent, setIntent] = useState<HabitIntent>(() => resolveIntent(intentHabit))
  const [trackingType, setTrackingType] = useState<HabitTrackingType>(habit?.tracking_type || 'check')
  const [frequency, setFrequency] = useState(habit?.frequency || 'daily')
  const [active, setActive] = useState(habit?.is_active ?? true)
  const [impulse, setImpulse] = useState(habit?.is_impulse_resistance ?? false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isPending, onClose])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('tracking_type', trackingType)
    formData.set('frequency', frequency)
    formData.set('is_active', String(active))
    formData.set('is_impulse_resistance', String(impulse && trackingType === 'counter'))
    if (trackingType === 'timer') {
      const minutes = Number(formData.get('target_minutes') || 0)
      formData.set('target_seconds', String(Math.max(1, Math.round(minutes * 60))))
    }

    setError('')
    startTransition(async () => {
      const result = await saveHabitAction(formData)
      if (!result.ok) return setError(result.error)
      const intentResult = await setHabitIntentAction(result.data.id, intent)
      if (!intentResult.ok) return setError(intentResult.error)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className={styles.dialogBackdrop} role="presentation">
      <section className={styles.formDialog} role="dialog" aria-modal="true" aria-labelledby="habit-form-title">
        <button type="button" className={styles.dialogClose} onClick={onClose} aria-label="Close habit form">×</button>
        <p className={styles.timerEyebrow}>{habit ? 'Refine training' : 'New discipline'}</p>
        <h2 id="habit-form-title">{habit ? `Edit ${habit.title}` : 'Create a Habit'}</h2>
        <p className={styles.formIntro}>Define the practice. A missed day will never erase what came before it.</p>

        <form className={styles.habitForm} onSubmit={submit}>
          {habit && <input type="hidden" name="id" value={habit.id} />}
          <label>
            <span>Title</span>
            <input ref={titleRef} name="title" defaultValue={habit?.title || ''} maxLength={100} required placeholder="Silence, movement, reading…" />
          </label>
          <label>
            <span>Description <em>optional</em></span>
            <textarea name="description" defaultValue={habit?.description || ''} maxLength={500} rows={3} placeholder="What are you training yourself to become?" />
          </label>

          <fieldset>
            <legend>Direction</legend>
            <div className={styles.trackingChoices}>
              <label className={intent === 'build' ? styles.choiceActive : ''}>
                <input type="radio" name="intent_choice" value="build" checked={intent === 'build'} onChange={() => setIntent('build')} />
                <strong>Build</strong>
                <small>Success means doing the practice.</small>
              </label>
              <label className={intent === 'avoid' ? styles.choiceActive : ''}>
                <input type="radio" name="intent_choice" value="avoid" checked={intent === 'avoid'} onChange={() => setIntent('avoid')} />
                <strong>Avoid</strong>
                <small>Success means keeping the boundary.</small>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Tracking</legend>
            <div className={styles.trackingChoices}>
              {(['check', 'counter', 'timer', 'stopwatch'] as const).map((type) => (
                <label key={type} className={trackingType === type ? styles.choiceActive : ''}>
                  <input type="radio" name="tracking_choice" value={type} checked={trackingType === type} onChange={() => { setTrackingType(type); if (type !== 'counter') setImpulse(false) }} />
                  <strong>{trackingLabel(type)}</strong>
                  <small>{type === 'check' ? 'Once' : type === 'counter' ? 'Quantity' : type === 'timer' ? 'Toward a target' : 'Open-ended time'}</small>
                </label>
              ))}
            </div>
          </fieldset>

          {trackingType === 'counter' && (
            <div className={styles.inlineFields}>
              <label><span>Target count</span><input type="number" name="target_value" min="1" step="1" defaultValue={habit?.target_value || 1} required /></label>
              <label><span>Unit</span><input name="target_unit" defaultValue={habit?.target_unit || 'repetitions'} maxLength={40} /></label>
            </div>
          )}
          {trackingType === 'timer' && (
            <label><span>Target minutes</span><input type="number" name="target_minutes" min="0.1" max="10080" step="0.1" defaultValue={habit?.target_seconds ? habit.target_seconds / 60 : 2} required /></label>
          )}

          <label>
            <span>Frequency</span>
            <select value={frequency} onChange={(event) => setFrequency(event.target.value as 'daily' | 'specific_days')}>
              <option value="daily">Every day</option>
              <option value="specific_days">Specific days</option>
            </select>
          </label>
          {frequency === 'specific_days' && (
            <fieldset>
              <legend>Training days</legend>
              <div className={styles.dayChoices}>
                {WEEKDAYS.map((day) => (
                  <label key={day.value}>
                    <input type="checkbox" name="days" value={day.value} defaultChecked={habit ? habit.days_of_week.includes(day.value) : day.value > 0 && day.value < 6} />
                    <span>{day.short}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend>Sigil</legend>
            <div className={styles.iconChoices}>
              {HABIT_ICON_NAMES.map((icon) => (
                <label key={icon} title={icon}>
                  <input type="radio" name="icon" value={icon} defaultChecked={(habit?.icon || 'training') === icon} />
                  <span aria-label={`${icon} sigil`}><MythicIcon name={icon} size={19} /></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.inlineFields}>
            <label>
              <span>Linked Skill <em>optional</em></span>
              <select name="skill_key" defaultValue={habit?.skill_key || ''}>
                <option value="">No linked skill</option>
                {SKILLS.map((skill) => <option key={skill} value={skill}>{SKILL_LABELS[skill]}</option>)}
              </select>
            </label>
            <label><span>XP reward</span><input type="number" name="xp_reward" min="0" max="100" step="1" defaultValue={habit?.xp_reward ?? 5} /></label>
          </div>

          {trackingType === 'counter' && (
            <label className={styles.toggleRow}>
              <input type="checkbox" checked={impulse} onChange={(event) => setImpulse(event.target.checked)} />
              <span><strong>Resisted an Impulse interaction</strong><small>Add the private, positive quick-record experience.</small></span>
            </label>
          )}
          <label className={styles.toggleRow}>
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span><strong>Active training</strong><small>Inactive habits keep all history but leave Today.</small></span>
          </label>

          {error && <p className={styles.formError} role="alert">{error}</p>}
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primaryButton} disabled={isPending}>{isPending ? 'Inscribing…' : habit ? 'Save changes' : 'Begin training'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function HabitsTrainingGrounds({ today, habits, logs, sessions, events, skillXp }: Props) {
  const router = useRouter()
  const [view, setView] = useState<TrainingView>('today')
  const [notice, setNotice] = useState<Notice>(null)
  const [pendingKey, setPendingKey] = useState('')
  const [editingHabit, setEditingHabit] = useState<HabitRow | null | undefined>(undefined)
  const [timerHabit, setTimerHabit] = useState<HabitRow | null>(null)
  const lockRef = useRef(false)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeHabits = habits.filter((habit) => habit.is_active)
  const todayLogs = useMemo(() => new Map(logs.filter((log) => log.logged_date === today).map((log) => [log.habit_id, log])), [logs, today])
  const activeSessions = useMemo(() => new Map(sessions.filter((session) => session.status !== 'finished').map((session) => [session.habit_id, session])), [sessions])
  const todayHabits = activeHabits.filter((habit) => isHabitScheduledOn(habit, today) || activeSessions.has(habit.id))
  const summary = calculateTrainingSummary({ habits, logs, today })
  const impulseHabit = activeHabits.find((habit) => habit.is_impulse_resistance) || null
  const analyticsByHabit = useMemo(() => {
    const logsByHabit = new Map<string, HabitLogRow[]>()
    const sessionCountByHabit = new Map<string, number>()
    for (const log of logs) {
      const group = logsByHabit.get(log.habit_id) ?? []
      group.push(log)
      logsByHabit.set(log.habit_id, group)
    }
    for (const session of sessions) {
      if (session.status !== 'finished') continue
      sessionCountByHabit.set(session.habit_id, (sessionCountByHabit.get(session.habit_id) || 0) + 1)
    }
    return new Map(habits.map((habit) => [
      habit.id,
      calculateHabitAnalytics({
        habit,
        logs: logsByHabit.get(habit.id) ?? [],
        today,
        totalSessions: habit.tracking_type === 'timer' || habit.tracking_type === 'stopwatch'
          ? sessionCountByHabit.get(habit.id) || 0
          : undefined,
      }),
    ]))
  }, [habits, logs, sessions, today])

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? VIEW_LABELS.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + VIEW_LABELS.length) % VIEW_LABELS.length
    setView(VIEW_LABELS[next].id)
    tabRefs.current[next]?.focus()
  }

  function runLocked(key: string, operation: () => Promise<void>) {
    if (lockRef.current) return
    lockRef.current = true
    setPendingKey(key)
    setNotice(null)
    void operation().finally(() => {
      lockRef.current = false
      setPendingKey('')
    })
  }

  function recordProgress(habit: HabitRow) {
    runLocked(habit.id, async () => {
      const result = await recordHabitProgressAction(habit.id, crypto.randomUUID())
      if (!result.ok) return setNotice({ tone: 'error', text: result.error })
      setNotice({ tone: 'success', text: result.data.reward_awarded ? `${habit.title} trained. +${result.data.xp_awarded} XP recorded.` : `${habit.title} progress recorded.` })
      router.refresh()
    })
  }

  function recordImpulse(category: ImpulseCategory | null) {
    if (!impulseHabit) return
    runLocked('impulse', async () => {
      const result = await recordImpulseAction(impulseHabit.id, crypto.randomUUID(), category)
      if (!result.ok) return setNotice({ tone: 'error', text: result.error })
      setNotice({ tone: 'success', text: 'Restraint recorded. The choice was yours.' })
      router.refresh()
    })
  }

  function addSuggestion(slug: string, key = slug) {
    runLocked(key, async () => {
      const result = await addSuggestedHabitAction(slug)
      if (!result.ok) return setNotice({ tone: 'error', text: result.error })
      setNotice({ tone: 'success', text: result.message || 'Training added.' })
      router.refresh()
    })
  }

  function toggleActive(habit: HabitRow) {
    runLocked(`active-${habit.id}`, async () => {
      const result = await setHabitActiveAction(habit.id, !habit.is_active)
      if (!result.ok) return setNotice({ tone: 'error', text: result.error })
      setNotice({ tone: 'success', text: habit.is_active ? `${habit.title} archived. Its history remains intact.` : `${habit.title} returned to active training.` })
      router.refresh()
    })
  }

  const timerSession = timerHabit ? activeSessions.get(timerHabit.id) || null : null
  const timerLog = timerHabit
    ? logs.find((log) => log.habit_id === timerHabit.id && log.logged_date === (timerSession?.logged_date || today)) || null
    : null

  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}><span aria-hidden>‹</span> Return to command</Link>
        <p className={styles.eyebrow}>Daily training</p>
        <h1>Training Grounds</h1>
        <p className={styles.subtitle}>Train what you repeat.</p>
        <p className={styles.date}>{dateLabel(today)}</p>
      </header>

      <section className={styles.summaryPanel} aria-label="Training summary">
        <div><strong>{summary.completedToday} / {summary.scheduledToday}</strong><span>trained today</span></div>
        <div><strong>{summary.last7.consistency}%</strong><span>last 7 days</span></div>
        <div><strong>{formatDuration(summary.practiceSecondsToday, true)}</strong><span>practice today</span></div>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Training views">
        {VIEW_LABELS.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => { tabRefs.current[index] = node }}
            type="button"
            role="tab"
            id={`habits-tab-${item.id}`}
            aria-selected={view === item.id}
            aria-controls={`habits-panel-${item.id}`}
            tabIndex={view === item.id ? 0 : -1}
            className={view === item.id ? styles.tabActive : ''}
            onClick={() => setView(item.id)}
            onKeyDown={(event) => moveTab(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice && <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`} role={notice.tone === 'error' ? 'alert' : 'status'}><MythicIcon name={notice.tone === 'error' ? 'notifications' : 'spark'} size={17} /><span>{notice.text}</span></div>}

      <section id="habits-panel-today" role="tabpanel" aria-labelledby="habits-tab-today" hidden={view !== 'today'} className={styles.panel}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionEyebrow}>Today&apos;s training</p><h2>Practices waiting for you</h2></div><button type="button" onClick={() => setEditingHabit(null)}><MythicIcon name="add" size={17} /> Add</button></div>
        {todayHabits.length > 0 ? (
          <div className={styles.habitList}>
            {todayHabits.map((habit) => <HabitProgressCard key={habit.id} habit={habit} log={todayLogs.get(habit.id) || null} session={activeSessions.get(habit.id) || null} pending={pendingKey === habit.id} onProgress={() => recordProgress(habit)} onOpenTimer={() => setTimerHabit(habit)} />)}
          </div>
        ) : (
          <div className={styles.emptyState}><MythicIcon name="training" size={29} /><h2>No training is scheduled today.</h2><p>Rest can be deliberate. Or define a practice worth returning to.</p><button type="button" onClick={() => setEditingHabit(null)}>Create a habit</button></div>
        )}

        <ImpulsePractice habit={impulseHabit} events={events} today={today} pending={pendingKey === 'impulse'} onRecord={recordImpulse} onSetup={() => addSuggestion('delayed-impulse', 'impulse')} />

        {habits.length === 0 && (
          <section className={styles.suggestions}>
            <div className={styles.sectionHeading}><div><p className={styles.sectionEyebrow}>Suggested disciplines</p><h2>Begin with something small</h2></div></div>
            <div className={styles.suggestionGrid}>{HABIT_SUGGESTIONS.filter((item) => !item.impulse).map((suggestion) => <button type="button" key={suggestion.slug} disabled={pendingKey === suggestion.slug} onClick={() => addSuggestion(suggestion.slug)}><MythicIcon name={suggestion.icon} size={19} /><span><strong>{suggestion.title}</strong><small>{suggestion.trackingType === 'timer' ? formatDuration(suggestion.targetSeconds || 0, true) : trackingLabel(suggestion.trackingType)}</small></span><em>{pendingKey === suggestion.slug ? 'Adding…' : 'Add'}</em></button>)}</div>
          </section>
        )}
      </section>

      <section id="habits-panel-progress" role="tabpanel" aria-labelledby="habits-tab-progress" hidden={view !== 'progress'} className={styles.panel}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionEyebrow}>Accumulated practice</p><h2>Training records</h2></div><span className={styles.sectionNote}>No progress is erased.</span></div>
        {habits.length > 0 ? <div className={styles.recordList}>{habits.map((habit) => <ProgressRecord key={habit.id} habit={habit} analytics={analyticsByHabit.get(habit.id)!} />)}</div> : <div className={styles.emptyState}><MythicIcon name="map" size={29} /><h2>Your record begins with the first repetition.</h2></div>}
      </section>

      <section id="habits-panel-manage" role="tabpanel" aria-labelledby="habits-tab-manage" hidden={view !== 'manage'} className={styles.panel}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionEyebrow}>Your disciplines</p><h2>Manage training</h2></div><button type="button" onClick={() => setEditingHabit(null)}><MythicIcon name="add" size={17} /> New habit</button></div>
        <div className={styles.manageList}>
          {habits.map((habit) => (
            <article key={habit.id} className={!habit.is_active ? styles.manageArchived : ''}>
              <span className={styles.recordIcon} aria-hidden><MythicIcon name={habitIcon(habit.icon)} size={19} /></span>
              <div><h3>{habit.title}</h3><p>{trackingLabel(habit.tracking_type)} · {scheduleLabel(habit)}{habit.skill_key ? ` · ${SKILL_LABELS[habit.skill_key]}` : ''}</p>{habit.skill_key && <small>{skillXp[habit.skill_key] || 0} current {SKILL_LABELS[habit.skill_key]} XP</small>}</div>
              <div className={styles.manageActions}><button type="button" onClick={() => setEditingHabit(habit)}>Edit</button><button type="button" disabled={pendingKey === `active-${habit.id}`} onClick={() => toggleActive(habit)}>{pendingKey === `active-${habit.id}` ? 'Saving…' : habit.is_active ? 'Archive' : 'Restore'}</button></div>
            </article>
          ))}
        </div>
        {habits.length === 0 && <div className={styles.emptyState}><MythicIcon name="training" size={29} /><h2>No disciplines defined yet.</h2><button type="button" onClick={() => setEditingHabit(null)}>Create your first habit</button></div>}
      </section>

      {timerHabit && <TimerFocus habit={timerHabit} todayLog={timerLog} initialSession={timerSession} onClose={() => setTimerHabit(null)} onNotice={setNotice} />}
      {editingHabit !== undefined && <HabitForm habit={editingHabit} onClose={() => setEditingHabit(undefined)} />}
    </main>
  )
}
