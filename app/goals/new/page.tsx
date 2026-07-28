import Link from 'next/link'
import { PILLAR_LABELS } from '@/lib/engines/goals'
import { MythicIcon } from '@/components/MythicIcons'
import { createGoalAction } from '../actions'
import styles from './new-goal.module.css'

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
  save: 'The campaign could not be recorded. Check that the goals table exists in Supabase.',
}

export default async function NewGoalPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>
}) {
  const params = await searchParams
  const err = params.err ? ERR[params.err] || 'Something went wrong.' : null

  return (
    <main className={styles.page}>
      <div className={styles.texture} aria-hidden />

      <header className={styles.header}>
        <Link href="/goals" className={styles.backButton} aria-label="Back to Campaign Atlas">‹</Link>
        <div>
          <p className={styles.eyebrow}>Strategic direction</p>
          <h1 className={styles.title}>Plot New Campaign</h1>
        </div>
        <div className={styles.headerSeal} aria-hidden>
          <MythicIcon name="plan" size={23} />
        </div>
      </header>

      {err && <div className={styles.error}>{err}</div>}

      <section className={styles.manifesto}>
        <p className={styles.manifestoTitle}>Name the direction before chasing motion</p>
        <p className={styles.manifestoBody}>
          A campaign should be important enough to shape decisions and concrete enough to advance through visible work.
        </p>
      </section>

      <form action={createGoalAction} className={styles.form}>
        <div className={styles.fields}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-title">Campaign title</label>
            <input
              id="goal-title"
              name="title"
              required
              placeholder="e.g. Complete 12 client review calls this month"
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-pillar">Pillar served</label>
            <select
              id="goal-pillar"
              name="pillar"
              defaultValue="stewardship"
              className={styles.select}
            >
              {PILLARS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="goal-horizon">Horizon</label>
              <select
                id="goal-horizon"
                name="horizon"
                defaultValue="weekly"
                className={styles.select}
              >
                {HORIZONS.map((horizon) => (
                  <option key={horizon.id} value={horizon.id}>{horizon.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="goal-weight">Campaign weight</label>
              <select
                id="goal-weight"
                name="weight"
                defaultValue="3"
                className={styles.select}
              >
                {[1, 2, 3, 4, 5].map((weight) => (
                  <option key={weight} value={weight}>{weight} of 5</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-target">Territory required</label>
            <input
              id="goal-target"
              name="target"
              type="number"
              min={1}
              defaultValue={4}
              className={styles.input}
            />
            <p className={styles.help}>The count that marks victory: calls, weeks, nights, sessions, milestones, or another real unit.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="goal-notes">Campaign doctrine · optional</label>
            <textarea
              id="goal-notes"
              name="notes"
              rows={3}
              placeholder="Why this matters, what winning changes, and what must not be sacrificed…"
              className={styles.textarea}
            />
          </div>

          <button type="submit" className={styles.submit}>
            <MythicIcon name="map" size={17} />
            <span>Mark the atlas</span>
          </button>
        </div>
      </form>
    </main>
  )
}
