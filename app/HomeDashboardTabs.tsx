'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import styles from './home-dashboard-tabs.module.css'

type HomeView = 'tasks' | 'habits' | 'goals'

type HomeDashboardTabsProps = {
  tasks: ReactNode
  habits: ReactNode
  goals: ReactNode
}

const VIEWS: Array<{ id: HomeView; label: string; icon: MythicIconName }> = [
  { id: 'tasks', label: 'Tasks', icon: 'quest' },
  { id: 'habits', label: 'Habits', icon: 'training' },
  { id: 'goals', label: 'Goals', icon: 'goals' },
]

const STORAGE_KEY = 'mythic-home-view'

function isHomeView(value: string | null): value is HomeView {
  return value === 'tasks' || value === 'habits' || value === 'goals'
}

export default function HomeDashboardTabs({ tasks, habits, goals }: HomeDashboardTabsProps) {
  const [active, setActive] = useState<HomeView>('tasks')
  const panels: Record<HomeView, ReactNode> = { tasks, habits, goals }
  const tabRefs = useRef<Record<HomeView, HTMLButtonElement | null>>({ tasks: null, habits: null, goals: null })

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    // Existing one-time hydration from localStorage; intentionally synchronized after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isHomeView(saved)) setActive(saved)
  }, [])

  function select(view: HomeView) {
    setActive(view)
    window.localStorage.setItem(STORAGE_KEY, view)
  }

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
    select(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className={styles.shell} aria-label="Daily action views">
      <nav className={styles.tabs} role="tablist" aria-label="Tasks, habits, and goals">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            id={`home-tab-${view.id}`}
            type="button"
            role="tab"
            aria-selected={active === view.id}
            aria-controls={`home-panel-${view.id}`}
            tabIndex={active === view.id ? 0 : -1}
            ref={(node) => { tabRefs.current[view.id] = node }}
            className={`${styles.tab} ${active === view.id ? styles.active : ''}`}
            onClick={() => select(view.id)}
            onKeyDown={(event) => moveFocus(event, view.id)}
          >
            <span className={styles.icon} aria-hidden><MythicIcon name={view.icon} size={14} /></span>
            {view.label}
          </button>
        ))}
      </nav>

      {VIEWS.map((view) => (
        <div key={view.id} id={`home-panel-${view.id}`} role="tabpanel" aria-labelledby={`home-tab-${view.id}`} hidden={active !== view.id} className={styles.panel}>
          {panels[view.id]}
        </div>
      ))}
    </section>
  )
}
