import Link from 'next/link'
import HuntArena from './HuntArena'
import { loadDailyHunt, loadRecentHuntVictories } from '@/lib/hunt-server'
import styles from './hunt.module.css'

export const dynamic = 'force-dynamic'

export default async function HuntPage() {
  const [snapshot, victories] = await Promise.all([
    loadDailyHunt(),
    loadRecentHuntVictories(6),
  ])
  const { boss, hunt, prep, companion } = snapshot
  const hpPct = hunt.boss_max_hp > 0
    ? Math.max(0, Math.min(100, Math.round((hunt.boss_hp / hunt.boss_max_hp) * 100)))
    : 0

  return (
    <main className={`${styles.page} safe-bottom`}>
      <div className={styles.wrap}>
        <div className={styles.topbar}>
          <Link href="/" className={styles.back}>← Home</Link>
          <span className={styles.daymark}>{snapshot.today} · One Hunt</span>
        </div>

        <section className={styles.hero} aria-labelledby="hunt-boss-name">
          <p className={styles.kicker}>{hunt.status === 'victory' ? 'Vanquished' : hunt.status === 'defeat' ? 'Escaped' : 'Today’s Hunt'}</p>
          <h1 id="hunt-boss-name" className={styles.bossName}>{boss.name}</h1>
          <p className={styles.bossTitle}>{boss.title}</p>
          <p className={styles.description}>{boss.description}</p>

          <div className={styles.healthBlock}>
            <div className={styles.healthLabels}>
              <span>Beast</span>
              <span>{hunt.boss_hp}/{hunt.boss_max_hp} HP</span>
            </div>
            <div className={styles.track} aria-label={`Boss health ${hpPct}%`}><span style={{ width: `${hpPct}%` }} /></div>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}><small>Your HP</small><strong>{hunt.player_hp}/5</strong></div>
            <div className={styles.stat}><small>Resolve</small><strong>{hunt.resolve}/4</strong></div>
            <div className={styles.stat}><small>Life Damage</small><strong>{hunt.prep_damage_applied}</strong></div>
          </div>

          <div className={styles.prep} aria-label="What weakened the Hunt">
            <span className={styles.chip}>{snapshot.completedTaskCount} task{snapshot.completedTaskCount === 1 ? '' : 's'}</span>
            <span className={styles.chip}>{snapshot.completedHabitCount} habit{snapshot.completedHabitCount === 1 ? '' : 's'}</span>
            {snapshot.morningDone && <span className={styles.chip}>Morning path set</span>}
            {snapshot.mainQuestDone && <span className={styles.chip}>Main Quest finished</span>}
            {companion.boonLabel && <span className={`${styles.chip} ${styles.boon}`}>{companion.boonLabel}</span>}
          </div>

          <p className={styles.description}>
            Your life already generated {prep.rawPower} Hunt power today. Real completions can keep weakening the beast, but they can never finish it for you—the last blow happens here.
          </p>
        </section>

        <HuntArena
          hunt={{
            bossHp: hunt.boss_hp,
            bossMaxHp: hunt.boss_max_hp,
            playerHp: hunt.player_hp,
            resolve: hunt.resolve,
            turn: hunt.turn,
            status: hunt.status,
            trophyName: hunt.trophy_name,
            victoryGold: hunt.victory_gold,
            battleLog: hunt.battle_log || [],
          }}
          telegraph={snapshot.telegraph}
          companionSlug={companion.slug}
        />

        {victories.length > 0 && (
          <section className={styles.history} aria-label="Recent Hunt trophies">
            <h2>Recent Trophies</h2>
            <div className={styles.historyList}>
              {victories.map((victory) => (
                <div key={victory.id} className={styles.historyRow}>
                  <div>
                    <strong>{victory.boss_name}</strong>
                    <small>{victory.hunt_date}</small>
                  </div>
                  <span>{victory.trophy_name || 'Unmarked Trophy'}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
