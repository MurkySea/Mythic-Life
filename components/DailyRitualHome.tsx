import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { campfireDigestForDate, chicagoDateKey, chicagoHour } from '@/lib/daily-ritual'
import { MythicIcon } from '@/components/MythicIcons'
import styles from './daily-ritual-home.module.css'

export default async function DailyRitualHome() {
  const supabase = await createClient()
  const today = chicagoDateKey()
  const hour = chicagoHour()

  const [ritualResult, systemResult] = await Promise.all([
    supabase
      .from('daily_rituals')
      .select('morning_completed_at, main_quest_title, morning_intention, morning_companion_slug')
      .eq('ritual_date', today)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('content, created_at')
      .eq('role', 'system')
      .order('created_at', { ascending: false })
      .limit(80),
  ])

  const ritual = ritualResult.data
  const morningDone = Boolean(ritual?.morning_completed_at)
  const eveningDigest = campfireDigestForDate(systemResult.data || [], today)
  const eveningDone = Boolean(eveningDigest)
  const eveningTime = hour >= 16

  let headline = 'Begin with intention. End with reflection.'
  if (morningDone && !eveningDone) headline = eveningTime ? 'The fire is waiting for the day you actually had.' : 'The day has a direction.'
  if (morningDone && eveningDone) headline = 'The day has a beginning and an ending.'
  if (!morningDone && eveningTime) headline = 'You can still return. Nothing needs to be made up.'

  return (
    <section className={styles.ritual} aria-label="Daily rhythm">
      <header className={styles.header}>
        <div>
          <p>Daily Rhythm</p>
          <h2>{headline}</h2>
        </div>
        <span className={styles.continuity}>Tomorrow remembers.</span>
      </header>

      <div className={styles.steps}>
        <Link href="/morning" className={`${styles.step} ${morningDone ? styles.complete : ''}`}>
          <span className={styles.icon}><MythicIcon name="spark" size={18} /></span>
          <span className={styles.copy}>
            <small>Morning</small>
            <strong>{morningDone ? ritual?.main_quest_title || 'Direction set' : 'Check in'}</strong>
            <em>{morningDone ? ritual?.morning_intention || 'You chose how to enter the day.' : hour >= 15 ? 'Still open. Nothing to make up.' : 'Choose one thing worth protecting today.'}</em>
          </span>
          <span className={styles.state}>{morningDone ? '✓' : '›'}</span>
        </Link>

        <span className={styles.bridge} aria-hidden />

        <Link href={`/camp?c=${ritual?.morning_companion_slug || 'seraphine'}`} className={`${styles.step} ${eveningDone ? styles.complete : ''} ${eveningTime && !eveningDone ? styles.ready : ''}`}>
          <span className={styles.icon}><MythicIcon name="messages" size={18} /></span>
          <span className={styles.copy}>
            <small>Evening</small>
            <strong>{eveningDone ? eveningDigest?.headline || 'Day closed' : eveningTime ? 'Return to the Campfire' : 'Evening Campfire'}</strong>
            <em>{eveningDone ? eveningDigest?.emotionalWeather || 'The day was remembered.' : eveningTime ? 'Tell the honest version while it is still fresh.' : 'The fire will be here tonight.'}</em>
          </span>
          <span className={styles.state}>{eveningDone ? '✓' : '›'}</span>
        </Link>
      </div>
    </section>
  )
}
