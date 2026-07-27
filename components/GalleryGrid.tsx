'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
  /** Current companion.image_url for this character (marks the active avatar) */
  currentAvatarUrl?: string | null
  /** Server action: set gallery image as companion avatar */
  setAvatarAction?: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
  /** Server action: clear custom avatar */
  clearAvatarAction?: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
}

export default function GalleryGrid({
  images,
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
    setActiveIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
    setStatus(null)
  }, [images.length])

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i + 1) % images.length))
    setStatus(null)
  }, [images.length])

  useEffect(() => {
    if (activeIndex === null) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [activeIndex, close, goPrev, goNext])

  if (!images.length) return null

  const active = activeIndex !== null ? images[activeIndex] : null
  const isCurrentAvatar =
    !!active &&
    !!currentAvatarUrl &&
    active.image_url === currentAvatarUrl

  function onSetAvatar() {
    if (!active || !setAvatarAction || pending) return
    const fd = new FormData()
    fd.set('image_url', active.image_url)
    fd.set('character_name', active.character_name)
    fd.set('gallery_id', active.id)
    startTransition(async () => {
      const result = await setAvatarAction(fd)
      if (result.ok) {
        setStatus('Avatar updated')
        router.refresh()
      } else {
        setStatus(result.error || 'Failed')
      }
    })
  }

  function onClearAvatar() {
    if (!active || !clearAvatarAction || pending) return
    const fd = new FormData()
    fd.set('character_name', active.character_name)
    startTransition(async () => {
      const result = await clearAvatarAction(fd)
      if (result.ok) {
        setStatus('Avatar cleared — using default')
        router.refresh()
      } else {
        setStatus(result.error || 'Failed')
      }
    })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {images.map((img, index) => {
          const isAvatar =
            !!currentAvatarUrl && img.image_url === currentAvatarUrl
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`bg-zinc-900 border rounded-xl overflow-hidden text-left active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 relative ${
                isAvatar
                  ? 'border-violet-500 ring-1 ring-violet-500/40'
                  : 'border-zinc-800'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image_url}
                alt={`${img.character_name} scene`}
                className="w-full aspect-[3/4] object-cover"
                loading="lazy"
              />
              {isAvatar && (
                <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-600 text-white font-medium shadow">
                  Avatar
                </span>
              )}
              <div className="p-2.5">
                {img.intimacyLabel && (
                  <p className="text-[10px] text-violet-400/80 uppercase tracking-wider">
                    {img.intimacyLabel}
                  </p>
                )}
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  {new Date(img.created_at).toLocaleDateString()}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {active && activeIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Full size scene"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 shrink-0">
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{active.character_name}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {active.intimacyLabel ? `${active.intimacyLabel} · ` : ''}
                {new Date(active.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
                {isCurrentAvatar ? ' · Avatar' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white hover:border-zinc-500 transition shrink-0"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div
            className="flex-1 relative flex items-center justify-center min-h-0 px-2"
            onClick={(e) => {
              if (e.target === e.currentTarget) close()
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.image_url}
              alt={`${active.character_name} full scene`}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    goPrev()
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-zinc-900/70 border border-zinc-700 text-white flex items-center justify-center hover:bg-zinc-800 transition hidden sm:flex"
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    goNext()
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-zinc-900/70 border border-zinc-700 text-white flex items-center justify-center hover:bg-zinc-800 transition hidden sm:flex"
                  aria-label="Next"
                >
                  ›
                </button>
              </>
            )}
          </div>

          <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 space-y-3">
            {setAvatarAction && (
              <div className="flex flex-wrap gap-2 items-center">
                {isCurrentAvatar ? (
                  <>
                    <span className="text-xs text-violet-300 px-3 py-2 rounded-full border border-violet-600/50 bg-violet-950/40">
                      Current avatar
                    </span>
                    {clearAvatarAction && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={onClearAvatar}
                        className="px-3.5 py-2 rounded-full text-xs border border-zinc-700 text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
                      >
                        {pending ? '…' : 'Use default'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onSetAvatar}
                    className="px-4 py-2.5 rounded-full text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white active:scale-95 transition disabled:opacity-50 disabled:cursor-wait"
                  >
                    {pending ? 'Setting…' : 'Set as avatar'}
                  </button>
                )}
                {status && (
                  <span className="text-xs text-zinc-400">{status}</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500 tabular-nums">
                {activeIndex + 1} / {images.length}
              </p>
              {images.length > 1 && (
                <div className="flex gap-2 sm:hidden">
                  <button
                    type="button"
                    onClick={goPrev}
                    className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-sm text-zinc-200"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-sm text-zinc-200"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
