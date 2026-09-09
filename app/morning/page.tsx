import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getCompanionDef } from '@/lib/companions'
import { chicagoDateKey, latestCampfireDigest } from '@/lib/daily-ritual'
import CompanionAvatar from '@/components/CompanionAvatar'
import { MythicIcon } from '@/components/MythicIcons'
import { PendingActionButton } from '@/components/PendingSubmit'
import { submitMorningRitual } from './actions'
import styles from './morning.module.css'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

type TaskOption = {
  id: string
  title: string
  must_do?: boolean | null
  is_today?: boolean | null
}

type RitualRow = {
  morning_companion_slug: string
  main_quest_task_id?: string | null
  main_quest_title?: string | null
  morning_intention?: string | null
  morning_resistance?: string | null
  morning_identity?: string | null
  morning_response?: string | null
  morning_completed_at?: string | null
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
}

export default async function MorningPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const today = chicagoDateKey()

  const [companionsResult, tasksResult, ritualResult, systemResult] = await Promise.all([
    supabase.from('companion').select('*').or('is_unlocked.eq.true,is_unlocked.is.null'),
    supabase
      .from('tasks')
      .select('id, title, must_do, is_today')
      .eq('is_completed', false)
      .order('must_do', { ascending: false })
      .order('is_today', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120),
    supabase.from('daily_rituals').select('*').eq('ritual_date', today).maybeSingle(),
    supabase
      .from('messages')
      .select('content, created_at')
      .eq('role', 'system')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const ritual = (ritualResult.data || null) as RitualRow | null
  const tasks = (tasksResult.data || []) as TaskOption[]
  const previousCampfire = latestCampfireDigest(systemResult.data || [], today)
  const party = (companionsResult.data || []).map((companion) => ({
    ...companion,
    slug:
      companion.slug ||
      (companion.name === 'Seraphine'
        ? 'seraphine'
        : companion.name?.toLowerCase().replace(/\s+/g, '_')),
  }))

  const requestedSlug = ritual?.morning_completed_at
    ? ritual.morning_companion_slug
    : params.c || 'seraphine'
  const companion =
    party.find((row) => row.slug === requestedSlug) ||
    party.find((row) => row.name === 'Seraphine') ||
    null
  const activeSlug = companion?.slug || requestedSlug
  const def = getCompanionDef(activeSlug)
  const displayName = companion?.name || def?.name || 'Seraphine'
  const completed = Boolean(ritual?.morning_completed_at)

  return (
    <main className={`${styles.page} safe-bottom`}>
      <div className={styles.sunriseGlow} aria-hidden />

      <header className={styles.topbar}>
        <Link href="/" className={styles.backButton} aria-label="Back to Home">‹</Link>
        <div>
          <p className={styles.eyebrow}>A daily ritual</p>
          <h1>Morning Check-In</h1>
        </div>
        <Link href="/today" className={styles.todayButton} aria-label="Open today's tasks">
          <MythicIcon name="quest" size={18} />
        </Link>
      </header>

      <section className={styles.scene}>
        <div className={styles.companionRow}>
          <CompanionAvatar
            slug={activeSlug}
            name={displayName}
            emoji={def?.emoji || '✦'}
            imageUrl={companion?.image_url}
            size="lg"
          />
          <div>
            <p>{def?.title || 'Companion'}</p>
            <h2>{displayName}</h2>
          </div>
        </div>
        <blockquote>
          “{completed
            ? 'Good. The day has a direction now.'
            : previousCampfire?.followUp || 'Before the day starts asking things from you — what deserves your attention first?'}”
        </blockquote>
      </section>

      {!completed && party.length > 1 && (
        <nav className={styles.partyRail} aria-label="Choose a companion for the morning">
          {party.map((member) => {
            const memberDef = getCompanionDef(member.slug)
            const memberName = member.name || memberDef?.name || 'Companion'
            const isActive = member.slug === activeSlug
            return (
              <Link
                key={member.id || member.slug}
                href={`/morning?c=${member.slug}`}
                className={`${styles.partyMember} ${isActive ? styles.activeMember : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <CompanionAvatar
                  slug={member.slug}
                  name={memberName}
                  emoji={memberDef?.emoji || '✦'}
                  imageUrl={member.image_url}
                  preferChibi
                  size="sm"
                />
                <span>{memberName}</span>
              </Link>
            )
          })}
        </nav>
      )}

      <section className={styles.ritualCard}>
        <header className={styles.ritualHeader}>
          <div>
            <p>{todayLabel()}</p>
            <h2>{completed ? 'The day is set' : 'Choose the day before it chooses you'}</h2>
          </div>
          <span className={styles.noScore}>No score. No streak.</span>
        </header>

        {previousCampfire && !completed && (
          <aside className={styles.emberCard}>
            <span className={styles.emberIcon}><MythicIcon name="spark" size={16} /></span>
            <div>
              <p>Last night’s ember</p>
              <strong>{previousCampfire.headline}</strong>
              {previousCampfire.carryForward && <span>{previousCampfire.carryForward}</span>}
            </div>
          </aside>
        )}

        {completed && ritual ? (
          <div className={styles.completedState}>
            <div className={styles.answerBlock}>
              <p>Main Quest</p>
              <strong>{ritual.main_quest_title || 'No single task — intention only'}</strong>
            </div>
            <div className={styles.answerGrid}>
              <div><p>What matters</p><span>{ritual.morning_intention}</span></div>
              <div><p>Resistance</p><span>{ritual.morning_resistance}</span></div>
              <div><p>How you’ll show up</p><span>{ritual.morning_identity}</span></div>
            </div>
            {ritual.morning_response && (
              <blockquote className={styles.response}>“{ritual.morning_response}”<cite>— {displayName}</cite></blockquote>
            )}
            <div className={styles.nextActions}>
              <Link href="/today" className={styles.primaryAction}>Enter the day</Link>
              <Link href={`/camp?c=${activeSlug}`} className={styles.secondaryAction}>Evening Campfire</Link>
            </div>
          </div>
        ) : (
          <form action={submitMorningRitual} className={styles.form}>
            <input type="hidden" name="companion_slug" value={activeSlug} />

            <label className={styles.field}>
              <span><strong>Main Quest</strong><small>Optional — one task that makes today count.</small></span>
              <select name="main_quest_task_id" defaultValue="">
                <option value="">No task selected — intention only</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.must_do ? '★ ' : task.is_today ? '• ' : ''}{task.title}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span><strong>What matters most today?</strong><small>Not everything. The thing worth protecting.</small></span>
              <textarea name="morning_intention" required maxLength={600} rows={3} placeholder="Today matters if…" />
            </label>

            <label className={styles.field}>
              <span><strong>Where will resistance show up?</strong><small>Name the thing you are most likely to avoid.</small></span>
              <textarea name="morning_resistance" required maxLength={600} rows={3} placeholder="I’ll probably want to avoid…" />
            </label>

            <label className={styles.field}>
              <span><strong>How do you want to show up?</strong><small>One sentence about the person, not the checklist.</small></span>
              <textarea name="morning_identity" required maxLength={600} rows={2} placeholder="I want to be…" />
            </label>

            <PendingActionButton
              label="Begin the day"
              pendingLabel={`${displayName} is listening…`}
              className={styles.submitButton}
            />
          </form>
        )}
      </section>

      <footer className={styles.footerNote}>
        Missed a morning? Nothing broke. Come back when you remember.
      </footer>
    </main>
  )
}
