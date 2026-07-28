import type { CSSProperties } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { SKILLS, SKILL_LABELS, xpIntoLevel, type SkillKey } from '@/lib/skills'
import { COMPANION_DEFS, meetsUnlock } from '@/lib/companions'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import { companionTone } from '@/lib/companion-tone'
import styles from './skills.module.css'

export const dynamic = 'force-dynamic'

const SKILL_META: Record<
  SkillKey,
  { icon: MythicIconName; description: string }
> = {
  faith: {
    icon: 'spark',
    description: 'Conviction practiced until belief becomes a way of standing.',
  },
  discipline: {
    icon: 'streak',
    description: 'The strength to return after mood, friction, and failure change.',
  },
  fitness: {
    icon: 'primaryQuest',
    description: 'Capacity earned through movement, recovery, and physical courage.',
  },
  knowledge: {
    icon: 'map',
    description: 'Understanding gathered, connected, and made useful in the world.',
  },
  relations: {
    icon: 'relationship',
    description: 'Trust built through attention, truth, repair, and chosen presence.',
  },
  business: {
    icon: 'goals',
    description: 'Value created through judgment, service, initiative, and execution.',
  },
  stewardship: {
    icon: 'currency',
    description: 'Resources ordered with wisdom, restraint, generosity, and purpose.',
  },
  wisdom: {
    icon: 'achievement',
    description: 'Experience integrated into better choices, timing, and perspective.',
  },
}

function gateProgress(
  unlock: Partial<Record<SkillKey, number>>,
  levels: Record<string, number>
): number {
  const entries = Object.entries(unlock) as [SkillKey, number][]
  if (entries.length === 0) return 100
  const total = entries.reduce((sum, [skill, required]) => {
    return sum + Math.min(1, (levels[skill] || 1) / required)
  }, 0)
  return Math.round((total / entries.length) * 100)
}

export default async function SkillsPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('player_skills').select('*')

  const xpMap: Record<string, number> = {}
  const levelMap: Record<string, number> = {}
  for (const row of rows || []) {
    xpMap[row.skill] = row.xp || 0
    levelMap[row.skill] = row.level || xpIntoLevel(row.xp || 0).level
  }

  for (const skill of SKILLS) {
    if (!levelMap[skill]) levelMap[skill] = xpIntoLevel(xpMap[skill] || 0).level
  }

  const gates = COMPANION_DEFS.filter((companion) => !companion.starter).map((companion) => ({
    ...companion,
    ready: meetsUnlock(companion.unlock, levelMap),
    progress: gateProgress(companion.unlock, levelMap),
  }))

  const totalXp = SKILLS.reduce((sum, skill) => sum + (xpMap[skill] || 0), 0)
  const totalLevels = SKILLS.reduce((sum, skill) => sum + (levelMap[skill] || 1), 0)
  const readyGates = gates.filter((gate) => gate.ready).length
  const strongest = SKILLS.reduce((best, skill) => {
    return (levelMap[skill] || 1) > (levelMap[best] || 1) ? skill : best
  }, SKILLS[0])

  return (
    <main className={styles.page}>
      <div className={styles.auraGold} aria-hidden />
      <div className={styles.auraViolet} aria-hidden />
      <div className={styles.auraBlue} aria-hidden />
      <div className={styles.stars} aria-hidden />

      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          <span className={styles.backGlyph} aria-hidden>‹</span>
          Return to command
        </Link>
        <p className={styles.eyebrow}>Progression & awakening</p>
        <h1 className={styles.title}>The Constellation Tree</h1>
        <p className={styles.subtitle}>
          Every completed act leaves light behind. Over time, those lights become paths—and some paths call others into your world.
        </p>
      </header>

      <section className={styles.overview}>
        <div className={styles.overviewCopy}>
          <p className={styles.sectionEyebrow}>Current constellation</p>
          <h2 className={styles.overviewTitle}>{SKILL_LABELS[strongest]} burns brightest</h2>
          <p className={styles.overviewText}>
            Tasks can feed more than one path. Growth is counted separately, but the constellation becomes stronger as a whole.
          </p>
          <div className={styles.overviewStats}>
            <div className={styles.overviewStat}>
              <p className={styles.overviewValue}>{totalXp}</p>
              <p className={styles.overviewLabel}>Total XP</p>
            </div>
            <div className={styles.overviewStat}>
              <p className={styles.overviewValue}>{totalLevels}</p>
              <p className={styles.overviewLabel}>Levels</p>
            </div>
            <div className={styles.overviewStat}>
              <p className={styles.overviewValue}>{readyGates}</p>
              <p className={styles.overviewLabel}>Gates Ready</p>
            </div>
          </div>
        </div>
        <div className={styles.overviewSeal} aria-label={`${totalLevels} combined skill levels`}>
          <div>
            <p className={styles.sealValue}>{totalLevels}</p>
            <p className={styles.sealLabel}>Combined light</p>
          </div>
        </div>
      </section>

      <section className={styles.constellation}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Eight living paths</p>
            <h2 className={styles.sectionTitle}>Your active constellation</h2>
          </div>
          <p className={styles.sectionHint}>Each level requires 50 XP. The paths advance independently.</p>
        </div>

        <div className={styles.skillGrid}>
          {SKILLS.map((skill) => {
            const xp = xpMap[skill] || 0
            const { level, into, need } = xpIntoLevel(xp)
            const percent = Math.min(100, (into / need) * 100)
            const meta = SKILL_META[skill]
            return (
              <article
                key={skill}
                className={styles.skillNode}
                data-skill={skill}
                style={{ '--progress': `${percent}%` } as CSSProperties}
              >
                <div className={styles.nodeTop}>
                  <span className={styles.nodeIcon} aria-hidden>
                    <MythicIcon name={meta.icon} size={21} />
                  </span>
                  <span className={styles.levelSeal} aria-label={`Level ${level}`}>{level}</span>
                </div>
                <h3 className={styles.nodeName}>{SKILL_LABELS[skill]}</h3>
                <p className={styles.nodeDescription}>{meta.description}</p>
                <div className={styles.nodeTrack} aria-label={`${Math.round(percent)}% to next level`}>
                  <div className={styles.nodeFill} />
                </div>
                <div className={styles.nodeMeta}>
                  <span>{into}/{need} XP</span>
                  <span>{xp} total</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className={styles.gates}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Awakening gates</p>
            <h2 className={styles.sectionTitle}>Who your growth is calling</h2>
          </div>
          <p className={styles.sectionHint}>A gate opens only when every required path reaches its threshold.</p>
        </div>

        <div className={styles.gateList}>
          {gates.map((companion) => {
            const requirements = Object.entries(companion.unlock) as [SkillKey, number][]
            return (
              <article
                key={companion.slug}
                className={`${styles.gate} ${companion.ready ? styles.gateReady : ''}`}
                data-tone={companionTone(companion.slug)}
              >
                <span className={styles.gateSigil} aria-hidden>{companion.name.slice(0, 1)}</span>
                <div>
                  <h3 className={styles.gateName}>{companion.name}</h3>
                  <p className={styles.gateTitle}>{companion.title} · {companion.rarity}</p>
                  <div className={styles.requirements}>
                    {requirements.length === 0 ? (
                      <span className={`${styles.requirement} ${styles.requirementMet}`}>No threshold</span>
                    ) : (
                      requirements.map(([skill, required]) => {
                        const met = (levelMap[skill] || 1) >= required
                        return (
                          <span
                            key={skill}
                            className={`${styles.requirement} ${met ? styles.requirementMet : ''}`}
                          >
                            {SKILL_LABELS[skill]} {levelMap[skill] || 1}/{required}
                          </span>
                        )
                      })
                    )}
                  </div>
                </div>
                <div className={styles.gateState}>
                  <p className={styles.gateStateLabel}>{companion.ready ? 'Ready' : 'Sealed'}</p>
                  <p className={styles.gateProgress}>{companion.progress}% aligned</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <p className={styles.footer}>Real work feeds the constellation. The constellation changes who can find you.</p>
    </main>
  )
}
