import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { loadRecentHuntVictories } from '@/lib/hunt-server'
import styles from './rewards.module.css'

export const dynamic = 'force-dynamic'

export default async function RewardsPage() {
  const supabase = await createClient()
  const [victories, standingResult] = await Promise.all([
    loadRecentHuntVictories(12),
    supabase
      .from('player_standing')
      .select('total_gold, total_xp, consistency_tokens')
      .eq('id', 'solo')
      .maybeSingle(),
  ])

  const standing = standingResult.data
  const gold = Math.round(Number(standing?.total_gold || 0))
  const xp = Math.round(Number(standing?.total_xp || 0))
  const consistency = Math.round(Number(standing?.consistency_tokens || 0))

  return (
    <main className={`${styles.page} safe-bottom`}>
      <div className={styles.wrap}>
        <Link href="/" className={styles.back}>← Home</Link>

        <section className={styles.hero}>
          <p className={styles.kicker}>Rewards</p>
          <h1>Trophy Hall</h1>
          <p>Not a store. A record of what you earned by actually showing up in the world.</p>

          <div className={styles.ledger}>
            <div className={styles.resource}><small>Gold</small><strong>{gold.toLocaleString()}</strong></div>
            <div className={styles.resource}><small>Total XP</small><strong>{xp.toLocaleString()}</strong></div>
            <div className={styles.resource}><small>Consistency</small><strong>{consistency.toLocaleString()}</strong></div>
          </div>
        </section>

        <section className={styles.section} aria-label="Hunt trophies">
          <div className={styles.sectionHeader}>
            <h2>Hunt Trophies</h2>
            <p>{victories.length} recorded</p>
          </div>

          {victories.length === 0 ? (
            <div className={styles.empty}>
              Nothing hangs on the wall yet. Your first Hunt trophy will appear here after a victory.
              <br />
              <Link href="/hunt" className={styles.huntLink}>Enter today’s Hunt →</Link>
            </div>
          ) : (
            <div className={styles.grid}>
              {victories.map((victory) => (
                <article key={victory.id} className={styles.trophy}>
                  <span className={styles.mark} aria-hidden>✦</span>
                  <div>
                    <strong>{victory.boss_name}</strong>
                    <small>{victory.boss_title} · {victory.hunt_date}</small>
                    <em>{victory.trophy_name || 'Unmarked Trophy'}</em>
                  </div>
                  <span className={styles.reward}>+{victory.victory_gold} gold</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
