import { resolveHeadshot } from '@/lib/staticAvatars'
import styles from './companion-presence.module.css'

export type CompanionPresenceVariant = 'hero' | 'roster' | 'party' | 'profile-card' | 'locked'

function join(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function companionTheme(slug: string): string {
  if (slug === 'seraphine') return 'silver'
  if (slug.includes('ember')) return 'ember'
  if (slug.includes('kira')) return 'crimson'
  if (slug.includes('nyx')) return 'void'
  if (slug.includes('mira')) return 'archive'
  if (slug.includes('lyra')) return 'dawn'
  if (slug.includes('kael')) return 'wild'
  if (slug.includes('selene')) return 'tide'
  if (slug.includes('iris')) return 'rose'
  return 'violet'
}

export function CompanionPresence({
  slug,
  name,
  title,
  imageUrl,
  emoji = '✦',
  rarity,
  stage,
  mood,
  variant = 'roster',
  leader = false,
  locked = false,
}: {
  slug: string
  name: string
  title?: string | null
  imageUrl?: string | null
  emoji?: string
  rarity?: string
  stage?: string
  mood?: string
  variant?: CompanionPresenceVariant
  leader?: boolean
  locked?: boolean
}) {
  const portrait = resolveHeadshot(slug, imageUrl)
  const theme = companionTheme(slug)

  return (
    <figure
      className={join(
        styles.presence,
        styles[variant],
        locked && styles.isLocked
      )}
      data-theme={theme}
    >
      <div className={styles.aura} aria-hidden />
      <div className={styles.innerFrame} aria-hidden />

      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.image} src={portrait} alt={name} />
      ) : (
        <div className={styles.fallback} aria-label={name}>
          <span>{emoji}</span>
        </div>
      )}

      <div className={styles.vignette} aria-hidden />
      <div className={styles.light} aria-hidden />

      <div className={styles.topBadges}>
        {rarity && <span className={styles.rarity}>{rarity}</span>}
        {leader && <span className={styles.leader}>Leader</span>}
        {locked && <span className={styles.lockedBadge}>Unawakened</span>}
      </div>

      <figcaption className={styles.caption}>
        {stage && <p className={styles.stage}>{stage}</p>}
        <h3 className={styles.name}>{name}</h3>
        {title && <p className={styles.title}>{title}</p>}
        {mood && <p className={styles.mood}>{mood}</p>}
      </figcaption>
    </figure>
  )
}
