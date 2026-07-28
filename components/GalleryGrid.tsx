'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanionTone } from '@/lib/companion-tone'
import styles from './gallery-grid.module.css'

export type GalleryImage = {
  id: string
  image_url: string
  character_name: string
  affinity_at_generation?: number | null
  created_at: string
  intimacyLabel?: string
}

type Props = {
  images: GalleryImage[]
  tone?: CompanionTone
  /** Current companion.image_url for this character (marks the active avatar) */
  currentAvatarUrl?: string | null
  /** Server action: set gallery image as companion avatar */
  setAvatarAction?: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
  /** Server action: clear custom avatar */
  clearAvatarAction?: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
}

function compactDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function GalleryGrid({
  images,
  tone = 'violet',
  currentAvatarUrl = null,
  setAvatarAction,
  clearAvatarAction,
}: Props) {
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<string | null>(null)

  const close = useCallback(() => {
    setActiveIndex(null)
    setStatus(null)
  }, [])

  const goPrev = useCallback(() => {
    setActiveIndex((index) =>
      index === null ? null : (index - 1 + images.length) % images.length
    )
    setStatus(null)
  }, [images.length])

  const goNext = useCallback(() => {
    setActiveIndex((index) =>
      index === null ? null : (index + 1) % images.length
    )
    setStatus(null)
  }, [images.length])

  useEffect(() => {
    if (activeIndex === null) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowLeft') goPrev()
      if (event.key === 'ArrowRight') goNext()
    }

    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [activeIndex, close, goPrev, goNext])

  if (!images.length) return null

  const active = activeIndex !== null ? images[activeIndex] : null
  const isCurrentAvatar =
    Boolean(active) && Boolean(currentAvatarUrl) && active?.image_url === currentAvatarUrl

  function onSetAvatar() {
    if (!active || !setAvatarAction || pending) return
    const formData = new FormData()
    formData.set('image_url', active.image_url)
    formData.set('character_name', active.character_name)
    formData.set('gallery_id', active.id)
    startTransition(async () => {
      const result = await setAvatarAction(formData)
      if (result.ok) {
        setStatus('Portrait updated')
        router.refresh()
      } else {
        setStatus(result.error || 'The portrait could not be changed')
      }
    })
  }

  function onClearAvatar() {
    if (!active || !clearAvatarAction || pending) return
    const formData = new FormData()
    formData.set('character_name', active.character_name)
    startTransition(async () => {
      const result = await clearAvatarAction(formData)
      if (result.ok) {
        setStatus('Default portrait restored')
        router.refresh()
      } else {
        setStatus(result.error || 'The portrait could not be restored')
      }
    })
  }

  return (
    <>
      <div className={styles.grid} data-tone={tone}>
        {images.map((image, index) => {
          const isAvatar = Boolean(currentAvatarUrl) && image.image_url === currentAvatarUrl
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`${styles.memory} ${isAvatar ? styles.avatarMemory : ''}`}
              aria-label={`Open ${image.character_name} memory from ${compactDate(image.created_at)}`}
            >
              <div className={styles.imageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.image_url}
                  alt={`${image.character_name} scene`}
                  className={styles.image}
                  loading="lazy"
                />
                <div className={styles.imageVeil} aria-hidden />
                {isAvatar && (
                  <span className={styles.avatarBadge}>
                    <span className={styles.avatarDot} aria-hidden />
                    Living portrait
                  </span>
                )}
              </div>
              <div className={styles.caption}>
                {image.intimacyLabel && (
                  <p className={styles.intimacy}>{image.intimacyLabel}</p>
                )}
                <p className={styles.date}>{compactDate(image.created_at)}</p>
              </div>
            </button>
          )
        })}
      </div>

      {active && activeIndex !== null && (
        <div
          className={styles.modal}
          data-tone={tone}
          role="dialog"
          aria-modal="true"
          aria-label="Memory viewing chamber"
        >
          <header className={styles.modalHeader}>
            <div>
              <p className={styles.modalKicker}>Preserved memory</p>
              <h2 className={styles.modalName}>{active.character_name}</h2>
              <p className={styles.modalMeta}>
                {active.intimacyLabel ? `${active.intimacyLabel} · ` : ''}
                {compactDate(active.created_at)}
                {isCurrentAvatar ? ' · Living portrait' : ''}
              </p>
            </div>
            <button type="button" onClick={close} className={styles.closeButton} aria-label="Close memory">
              ×
            </button>
          </header>

          <div
            className={styles.viewer}
            onClick={(event) => {
              if (event.target === event.currentTarget) close()
            }}
          >
            <div className={styles.frame}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.image_url}
                alt={`${active.character_name} full scene`}
                className={styles.fullImage}
                draggable={false}
              />
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    goPrev()
                  }}
                  className={`${styles.navButton} ${styles.prev}`}
                  aria-label="Previous memory"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    goNext()
                  }}
                  className={`${styles.navButton} ${styles.next}`}
                  aria-label="Next memory"
                >
                  ›
                </button>
              </>
            )}
          </div>

          <footer className={styles.modalFooter}>
            {setAvatarAction && (
              <div className={styles.actionRow}>
                <div className={styles.actionRow}>
                  {isCurrentAvatar ? (
                    <>
                      <span className={styles.currentBadge}>Current portrait</span>
                      {clearAvatarAction && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={onClearAvatar}
                          className={styles.secondaryButton}
                        >
                          {pending ? 'Restoring…' : 'Use default'}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={onSetAvatar}
                      className={styles.primaryButton}
                    >
                      {pending ? 'Binding portrait…' : 'Set as portrait'}
                    </button>
                  )}
                </div>
                {status && <span className={styles.status}>{status}</span>}
              </div>
            )}

            <div className={styles.paginationRow}>
              <p className={styles.counter}>{activeIndex + 1} of {images.length}</p>
              {images.length > 1 && (
                <div className={styles.mobileNav}>
                  <button type="button" onClick={goPrev} className={styles.mobileNavButton}>Previous</button>
                  <button type="button" onClick={goNext} className={styles.mobileNavButton}>Next</button>
                </div>
              )}
            </div>
          </footer>
        </div>
      )}
    </>
  )
}
