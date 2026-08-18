'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IntroScene } from '@/lib/intro-story'
import styles from './new-game.module.css'

type IntroStoryProps = {
  scenes: IntroScene[]
}

export default function IntroStory({ scenes }: IntroStoryProps) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)

  const scene = scenes[index]
  const isFirst = index === 0
  const isLast = index === scenes.length - 1

  function go(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= scenes.length || nextIndex === index) return
    setLeaving(true)
    window.setTimeout(() => {
      setIndex(nextIndex)
      setLeaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 180)
  }

  function continueStory() {
    if (isLast) {
      router.push('/new-game/begin')
      return
    }
    go(index + 1)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && !isFirst) go(index - 1)
      if ((event.key === 'ArrowRight' || event.key === 'Enter') && !leaving) continueStory()
      if (event.key === 'Escape') router.push('/')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <main className={styles.shell}>
      <div
        className={`${styles.backdrop} ${leaving ? styles.backdropLeaving : ''}`}
        style={{ backgroundImage: `url(${scene.image})` }}
        role="img"
        aria-label={scene.alt}
      />
      <div className={styles.scrim} aria-hidden />
      <div className={styles.glow} aria-hidden />

      <section className={`${styles.storyCard} ${leaving ? styles.cardLeaving : ''}`} aria-live="polite">
        <header className={styles.storyHeader}>
          <div>
            <p className={styles.eyebrow}>New Game · Chapter {scene.chapter}</p>
            <h1>{scene.title}</h1>
          </div>
          <span className={styles.time}>{scene.time}</span>
        </header>

        <div className={styles.copy}>
          {scene.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        {scene.quote && (
          <blockquote className={styles.quote}>
            <p>“{scene.quote}”</p>
            {scene.speaker && <cite>— {scene.speaker}</cite>}
          </blockquote>
        )}

        {isLast && (
          <div className={styles.bondCard}>
            <div>
              <span>Bond</span>
              <strong>Unbreakable</strong>
            </div>
            <div>
              <span>Relationship</span>
              <strong>Undefined</strong>
            </div>
          </div>
        )}

        <footer className={styles.controls}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => go(index - 1)}
            disabled={isFirst || leaving}
          >
            Back
          </button>

          <div className={styles.progress} aria-label={`Scene ${index + 1} of ${scenes.length}`}>
            {scenes.map((item, sceneIndex) => (
              <button
                type="button"
                key={item.id}
                className={`${styles.dot} ${sceneIndex === index ? styles.dotActive : ''}`}
                aria-label={`Go to chapter ${item.chapter}`}
                onClick={() => go(sceneIndex)}
                disabled={leaving}
              />
            ))}
          </div>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={continueStory}
            disabled={leaving}
          >
            {isLast ? 'Begin the Journey' : 'Continue'}
          </button>
        </footer>

        <button type="button" className={styles.skip} onClick={() => router.push('/')}>
          Skip prologue
        </button>
      </section>
    </main>
  )
}
