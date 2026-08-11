import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PILLAR_LABELS } from '@/lib/engines/goals'
import { getGoal } from '@/lib/engines/goals-store'
import { MythicIcon } from '@/components/MythicIcons'
import { updateGoalAction } from '../../actions'
import styles from '../../new/new-goal.module.css'

export const dynamic = 'force-dynamic'

const PILLARS = Object.entries(PILLAR_LABELS) as [string, string][]
const HORIZONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'season', label: 'Season' },
  { id: 'ongoing', label: 'Ongoing' },
]

const ERR: Record<string, string> = {
  title: 'Give the campaign a clear title.',
  pillar: 'Choose the pillar this campaign serves.',
  horizon: 'Choose the horizon you intend to hold.',
  save: 'The campaign could not be updated.',
}

export default async function EditGoalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ err?: string }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const goal = await getGoal(id)
  if (!goal) notFound()
  const err = query.err ? ERR[query.err] || 'Something went wrong.' : null

  return (
    <main className={styles.page}>
      <div className={styles.texture} aria-hidden />
      <header className={styles.header}>
        <Link href="/goals" className={styles.backButton} aria-label="Back to Campaign Atlas">‹</Link>
        <div>
          <p className={styles.eyebrow}>Strategic direction</p>
          <h1 className={styles.title}>Edit Campaign</h1>
        </div>
        <div className={styles.headerSeal} aria-hidden><MythicIcon name="plan" size={23} /></div>
      </header>

      {err && <div className={styles.error}>{err}</div>}

      <form action={updateGoalAction} className={styles.form}>
        <input type="hidden" name="id" value={goal.id} />
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-title">Campaign title</label>
            <input id="goal-title" name="title" required defaultValue={goal.title} className={styles.input} />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-pillar">Pillar served</label>
            <select id="goal-pillar" name="pillar" defaultValue={goal.pillar} className={styles.select}>
              {PILLARS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="goal-horizon">Horizon</label>
              <select id="goal-horizon" name="horizon" defaultValue={goal.horizon} className={styles.select}>
                {HORIZONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="goal-weight">Campaign weight</label>
              <select id="goal-weight" name="weight" defaultValue={String(goal.weight)} className={styles.select}>
                {[1, 2, 3, 4, 5].map((weight) => <option key={weight} value={weight}>{weight} of 5</option>)}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-target">Territory required</label>
            <input id="goal-target" name="target" type="number" min={Math.max(1, goal.progress)} defaultValue={goal.target} className={styles.input} />
            <p className={styles.help}>Current progress is {goal.progress}. The target cannot be reduced below progress already earned.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-notes">Campaign doctrine · optional</label>
            <textarea id="goal-notes" name="notes" rows={3} defaultValue={goal.notes || ''} className={styles.textarea} />
          </div>

          <button type="submit" className={styles.submit}>
            <MythicIcon name="map" size={17} />
            <span>Save campaign</span>
          </button>
        </div>
      </form>
    </main>
  )
}
