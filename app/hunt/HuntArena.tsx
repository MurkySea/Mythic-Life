'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { performHuntAction } from './actions'
import type { HuntAction, HuntStatus, ParryQuality } from '@/lib/hunt'
import styles from './hunt.module.css'

type LogEntry = {
  turn: number
  action: HuntAction
  line: string
  bossDamage: number
  playerDamage: number
}

type Props = {
  hunt: {
    bossHp: number
    bossMaxHp: number
    playerHp: number
    resolve: number
    turn: number
    status: HuntStatus
    trophyName: string | null
    victoryGold: number
    battleLog: LogEntry[]
  }
  telegraph: string | null
  companionSlug: string
}

function parryQuality(position: number): ParryQuality {
  if (position >= 46 && position <= 54) return 'perfect'
  if (position >= 38 && position <= 62) return 'good'
  return 'miss'
}

export default function HuntArena({ hunt, telegraph, companionSlug }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [parryArmed, setParryArmed] = useState(false)
  const [marker, setMarker] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!parryArmed) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setMarker(50)
      return
    }

    const started = performance.now()
    const cycle = 1300
    const tick = (now: number) => {
      const phase = ((now - started) % cycle) / cycle
      const position = phase <= 0.5 ? phase * 200 : (1 - phase) * 200
      setMarker(position)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [parryArmed])

  function act(action: HuntAction, quality?: ParryQuality) {
    setError(null)
    const formData = new FormData()
    formData.set('action', action)
    if (quality) formData.set('parry_quality', quality)

    startTransition(async () => {
      try {
        await performHuntAction(formData)
        setParryArmed(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The Hunt did not advance.')
      }
    })
  }

  const closed = hunt.status === 'victory' || hunt.status === 'defeat'
  const canResolve = hunt.resolve > 0 && !pending && !closed
  const recent = [...hunt.battleLog].slice(-4).reverse()

  if (hunt.status === 'victory') {
    return (
      <section className={styles.outcome} aria-live="polite">
        <p className={styles.kicker}>Hunt Complete</p>
        <h2>The creature falls.</h2>
        <p>You earned a trophy because the day had a real ending, not because you kept tapping.</p>
        <div className={styles.trophy}>✦ {hunt.trophyName || 'Unmarked Trophy'}</div>
        <p>+{hunt.victoryGold} gold</p>
        <Link href={`/messages?c=${companionSlug}`} className={styles.messageLink}>See what your companion has to say →</Link>
      </section>
    )
  }

  if (hunt.status === 'defeat') {
    return (
      <section className={styles.outcome} aria-live="polite">
        <p className={styles.kicker}>The Trail Goes Cold</p>
        <h2>The beast got away today.</h2>
        <p>No streak broke. No debt was created. Tomorrow brings a different Hunt.</p>
      </section>
    )
  }

  return (
    <section className={styles.arena} aria-label="Hunt combat">
      <div className={styles.telegraph}>
        <small>{hunt.turn === 0 ? 'First Read' : `Turn ${hunt.turn + 1}`}</small>
        <p>{telegraph || 'The creature watches you carefully.'}</p>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={pending || parryArmed} onClick={() => act('strike')}>
          <strong>Strike</strong>
          <span>Aggressive damage. You may trade health if you swing into danger.</span>
        </button>
        <button type="button" className={styles.action} disabled={pending || parryArmed} onClick={() => act('guard')}>
          <strong>Guard</strong>
          <span>Safer defense. Some reads let you regain Resolve.</span>
        </button>
        <button type="button" className={styles.action} disabled={!canResolve || parryArmed} onClick={() => act('dodge')}>
          <strong>Dodge</strong>
          <span>Best against heavy windups.</span>
          <span className={styles.actionCost}>Costs 1 Resolve</span>
        </button>
        <button type="button" className={styles.action} disabled={!canResolve || parryArmed} onClick={() => setParryArmed(true)}>
          <strong>Parry</strong>
          <span>Highest reward against a fast edge. Timing matters.</span>
          <span className={styles.actionCost}>Costs 1 Resolve</span>
        </button>
      </div>

      {parryArmed && (
        <div className={styles.parryBox}>
          <div className={styles.parryLabel}><span>Lock the rune in the center.</span><strong>{parryQuality(marker)}</strong></div>
          <div className={styles.meter} aria-label="Parry timing meter">
            <span className={styles.goodZone} aria-hidden />
            <span className={styles.perfectZone} aria-hidden />
            <span className={styles.marker} style={{ left: `${marker}%` }} aria-hidden />
          </div>
          <div className={styles.parryButtons}>
            <button type="button" className={styles.lock} disabled={pending} onClick={() => act('parry', parryQuality(marker))}>Lock Parry</button>
            <button type="button" className={styles.cancel} disabled={pending} onClick={() => setParryArmed(false)}>Cancel</button>
          </div>
        </div>
      )}

      {pending && <p className={styles.logEntry}>Steel is moving…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      {recent.length > 0 && (
        <div className={styles.log} aria-label="Recent combat">
          {recent.map((entry) => (
            <p key={`${entry.turn}-${entry.action}`} className={styles.logEntry}>
              <strong>Turn {entry.turn} · {entry.action}</strong> — {entry.line}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
