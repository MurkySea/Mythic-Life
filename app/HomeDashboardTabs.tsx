'use client'

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import styles from './home-dashboard-tabs.module.css'

type HomeView = 'command' | 'journey' | 'grimoire'

type HomeDashboardTabsProps = {
  command: ReactNode
  journey: ReactNode
  grimoire: ReactNode
}

const VIEWS: Array<{
  id: HomeView
  label: string
  icon: MythicIconName
}> = [
  { id: 'command', label: 'Command', icon: 'quest' },
  { id: 'journey', label: 'Journey', icon: 'standing' },
  { id: 'grimoire', label: 'Grimoire', icon: 'skills' },
]

export default function HomeDashboardTabs({
  command,
  journey,
  grimoire,
}: HomeDashboardTabsProps) {
  const [active, setActive] = useState<HomeView>('command')
  const panels: Record<HomeView, ReactNode> = { command, journey, grimoire }
  const tabRefs = useRef<Record<HomeView, HTMLButtonElement | null>>({
    command: null,
    journey: null,
    grimoire: null,
  })

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, current: HomeView) {
    const index = VIEWS.findIndex((view) => view.id === current)
    let nextIndex = index

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % VIEWS.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + VIEWS.length) % VIEWS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = VIEWS.length - 1
    else return

    event.preventDefault()
    const next = VIEWS[nextIndex].id
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className={styles.shell} aria-label="Command center views">
      <nav
        className={styles.tabs}
        role="tablist"
        aria-label="Home views"
        aria-orientation="horizontal"
      >
        {VIEWS.map((view) => (
          <button
            key={view.id}
            id={`home-tab-${view.id}`}
            type="button"
            role="tab"
            aria-selected={active === view.id}
            aria-controls={`home-panel-${view.id}`}
            tabIndex={active === view.id ? 0 : -1}
            ref={(node) => {
              tabRefs.current[view.id] = node
            }}
            className={`${styles.tab} ${active === view.id ? styles.active : ''}`}
            onClick={() => setActive(view.id)}
            onKeyDown={(event) => moveFocus(event, view.id)}
          >
            <span className={styles.icon} aria-hidden>
              <MythicIcon name={view.icon} size={13} />
            </span>
            {view.label}
          </button>
        ))}
      </nav>

      {VIEWS.map((view) => (
        <div
          key={view.id}
          id={`home-panel-${view.id}`}
          role="tabpanel"
          aria-labelledby={`home-tab-${view.id}`}
          hidden={active !== view.id}
          className={styles.panel}
        >
          {panels[view.id]}
        </div>
      ))}
    </section>
  )
}
