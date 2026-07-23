'use client'

import { useCallback, useEffect, useState } from 'react'

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
}

export default function GalleryGrid({ images }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const close = useCallback(() => setActiveIndex(null), [])

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
  }, [images.length])

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i + 1) % images.length))
  }, [images.length])

  // Keyboard + body scroll lock
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

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {images.map((img, index) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-left active:scale-[0.98] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.image_url}
              alt={`${img.character_name} scene`}
              className="w-full aspect-[3/4] object-cover"
              loading="lazy"
            />
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
        ))}
      </div>

      {/* Full-size lightbox */}
      {active && activeIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Full size scene"
        >
          {/* Top bar */}
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

          {/* Image stage */}
          <div
            className="flex-1 relative flex items-center justify-center min-h-0 px-2"
            onClick={(e) => {
              // click empty space closes; ignore clicks on img/buttons
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

            {/* Nav arrows (desktop / larger) */}
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

          {/* Bottom controls for mobile */}
          <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 flex items-center justify-between gap-3">
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
      )}
    </>
  )
}
