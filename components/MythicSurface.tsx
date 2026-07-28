import type { ReactNode } from 'react'
import Link from 'next/link'
import styles from './mythic-surface.module.css'

function join(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function MythicPage({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main className={join(styles.page, className)}>
      <div className={styles.atmosphere} aria-hidden />
      {children}
    </main>
  )
}

export function MythicPageHeader({
  eyebrow,
  title,
  subtitle,
  backHref = '/',
  backLabel = 'Home',
  aside,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  aside?: ReactNode
}) {
  return (
    <header className={styles.header}>
      <Link href={backHref} className={styles.backLink}>
        <span aria-hidden>‹</span>
        {backLabel}
      </Link>
      <div className={styles.headerRow}>
        <div className={styles.headerCopy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {aside && <div className={styles.headerAside}>{aside}</div>}
      </div>
    </header>
  )
}

export function MythicPanel({
  children,
  tone = 'neutral',
  emphasis = false,
  className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'gold' | 'blue' | 'violet'
  emphasis?: boolean
  className?: string
}) {
  return (
    <div
      className={join(
        styles.panel,
        tone !== 'neutral' && styles[tone],
        emphasis && styles.emphasis,
        className
      )}
    >
      <div className={styles.panelContent}>{children}</div>
    </div>
  )
}

export function MythicSectionHeader({
  title,
  hint,
  sigil = '✦',
}: {
  title: string
  hint?: string
  sigil?: string
}) {
  return (
    <div className={styles.sectionHeader}>
      <div className={styles.sectionTitleWrap}>
        <span className={styles.sectionSigil} aria-hidden>
          <span>{sigil}</span>
        </span>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      {hint && <span className={styles.sectionHint}>{hint}</span>}
    </div>
  )
}

export function MythicEmptyState({
  title,
  body,
  mark = '◇',
}: {
  title: string
  body?: string
  mark?: string
}) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyMark} aria-hidden>
        {mark}
      </div>
      <p className={styles.emptyTitle}>{title}</p>
      {body && <p className={styles.emptyBody}>{body}</p>}
    </div>
  )
}

export function MythicSeal({
  children,
  label,
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <div className={styles.seal} aria-label={label}>
      {children}
    </div>
  )
}
