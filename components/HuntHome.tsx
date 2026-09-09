import Link from 'next/link'
import { loadDailyHunt } from '@/lib/hunt-server'
import { MythicIcon } from '@/components/MythicIcons'
import styles from './hunt-home.module.css'

export default async function HuntHome() {
  const snapshot = await loadDailyHunt()
  const { boss, hunt, companion } = snapshot
  const hpPct = hunt.boss_max_hp > 0
    ? Math.max(0, Math.min(100, Math.round((hunt.boss_hp / hunt.boss_max_hp) * 100)))
    : 0

  let state = 'A creature is on the road.'
  let action = 'Face the Hunt'
  if (hunt.status === 'active') state = `Turn ${hunt.turn + 1}. ${hunt.boss_hp} HP remains.`
  if (hunt.status === 'victory') {
    state = `${hunt.trophy_name || 'A trophy'} is yours.`
    action = 'View Trophy'
  }
  if (hunt.status === 'defeat') {
    state = 'The trail went cold. Tomorrow brings another.'
    action = 'View the Trail'
  }

  return (
    <Link href="/hunt" className={styles.hunt} aria-label={`Today's Hunt: ${boss.name}`}>
      <div className={styles.icon}><MythicIcon name="primaryQuest" size={21} /></div>
      <div className={styles.body}>
        <div className={styles.header}>
          <span>Today’s Hunt</span>
          <em>{hunt.status === 'victory' ? 'Vanquished' : hunt.status === 'defeat' ? 'Escaped' : `${hunt.boss_hp}/${hunt.boss_max_hp} HP`}</em>
        </div>
        <strong>{boss.name}</strong>
        <small>{boss.title}</small>
        <div className={styles.track}><i style={{ width: `${hpPct}%` }} /></div>
        <p>{state}</p>
        {companion.boonLabel && <p className={styles.boon}>{companion.name} is with you · +1 Resolve</p>}
      </div>
      <span className={styles.action}>{action} →</span>
    </Link>
  )
}
