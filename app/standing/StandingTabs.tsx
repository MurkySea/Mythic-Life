import Link from 'next/link'
import { MythicIcon } from '@/components/MythicIcons'
import styles from './standing-tabs.module.css'

export function StandingTabs({ active }: { active: 'standing' | 'health' }) {
  return (
    <nav className={styles.tabs} aria-label="Standing views">
      <Link
        href="/standing"
        className={`${styles.tab} ${active === 'standing' ? styles.active : ''}`}
      >
        <span className={styles.icon} aria-hidden><MythicIcon name="standing" size={13} /></span>
        Soul Ledger
      </Link>
      <Link
        href="/standing/health"
        className={`${styles.tab} ${active === 'health' ? styles.active : ''}`}
      >
        <span className={styles.icon} aria-hidden><MythicIcon name="streak" size={13} /></span>
        Vital Signs
      </Link>
    </nav>
  )
}
