'use client'

import { useState, type ReactNode } from 'react'
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

  return (
    <section className={styles.shell} aria-label="Command center views">
      <nav className={styles.tabs} role="tablist" aria-label="Home views">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            id={`home-tab-${view.id}`}
            type="button"
            role="tab"
            aria-selected={active === view.id}
            aria-controls={`home-panel-${view.id}`}
            className={`${styles.tab} ${active === view.id ? styles.active : ''}`}
            onClick={() => setActive(view.id)}
          >
            <span className={styles.icon} aria-hidden>
              <MythicIcon name={view.icon} size={13} />
            </span>
            {view.label}
          </button>
        ))}
      </nav>

      <div
        key={active}
        id={`home-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`home-tab-${active}`}
        className={styles.panel}
      >
        {panels[active]}
      </div>
    </section>
  )
}
