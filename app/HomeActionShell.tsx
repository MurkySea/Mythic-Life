'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { MythicIcon, type MythicIconName } from '@/components/MythicIcons'
import styles from './home-action-shell.module.css'

type HomeView = 'tasks' | 'habits' | 'goals'

type MenuItem = {
  href: string
  label: string
  sub: string
  icon: MythicIconName
  developer?: boolean
}

type Props = {
  tasks: ReactNode
  habits: ReactNode
  goals: ReactNode
  menuItems: MenuItem[]
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

export default function HomeActionShell({ tasks, habits, goals, menuItems }: Props) {
  const [active, setActive] = useState<HomeView>('tasks')
  const [menuOpen, setMenuOpen] = useState(false)
  const tabRefs = useRef<Record<HomeView, HTMLButtonElement | null>>({ tasks: null, habits: null, goals: null })
  const panels = useMemo<Record<HomeView, ReactNode>>(() => ({ tasks, habits, goals }), [tasks, habits, goals])

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isHomeView(saved)) setActive(saved)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

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
    <>
      <section className={styles.shell} aria-label="Primary life actions">
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
              <MythicIcon name={view.icon} size={17} />
              <span>{view.label}</span>
            </button>
          ))}
        </nav>

        {VIEWS.map((view) => (
          <div key={view.id} id={`home-panel-${view.id}`} role="tabpanel" aria-labelledby={`home-tab-${view.id}`} hidden={active !== view.id} className={styles.panel}>
            {panels[view.id]}
          </div>
        ))}
      </section>

      <button type="button" className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label="Open Mythic Life menu" aria-expanded={menuOpen}>
        <span aria-hidden>☰</span>
      </button>

      {menuOpen && (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setMenuOpen(false) }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="mythic-menu-title">
            <div className={styles.drawerHeader}>
              <div><p>Mythic Life</p><h2 id="mythic-menu-title">More</h2></div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
            </div>
            <nav className={styles.menuList} aria-label="Secondary destinations">
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href} className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                  <span className={styles.menuIcon}><MythicIcon name={item.icon} size={19} /></span>
                  <span><strong>{item.label}</strong><small>{item.sub}</small>{item.developer && <em>Developer</em>}</span>
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
