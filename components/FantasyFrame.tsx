/** Decorative fantasy frames + tiles — class-driven, minimal inline style */

import {
  MODULE_ICONS,
  type ModuleIconKey,
} from './MythicIcons'

export function CornerOrnaments({
  tone = 'gold',
}: {
  tone?: 'gold' | 'violet'
}) {
  const color =
    tone === 'gold' ? 'rgba(212,168,83,0.65)' : 'rgba(167,139,250,0.45)'
  return (
    <>
      <svg className="absolute top-2 left-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M1 12V3.5C1 2.12 2.12 1 3.5 1H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M1 7C3 7 5 5 5 3" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      </svg>
      <svg className="absolute top-2 right-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M19 12V3.5C19 2.12 17.88 1 16.5 1H8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M19 7C17 7 15 5 15 3" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      </svg>
      <svg className="absolute bottom-2 left-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M1 8V16.5C1 17.88 2.12 19 3.5 19H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M1 13C3 13 5 15 5 17" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      </svg>
      <svg className="absolute bottom-2 right-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M19 8V16.5C19 17.88 17.88 19 16.5 19H8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M19 13C17 13 15 15 15 17" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      </svg>
    </>
  )
}

export function Plate({
  children,
  className = '',
  gold = false,
  emphasis = false,
}: {
  children: React.ReactNode
  className?: string
  gold?: boolean
  /** Stronger visual weight for primary content (active quest, progress) */
  emphasis?: boolean
}) {
  const tone = gold ? 'gold' : 'violet'
  return (
    <div
      className={[
        'plate relative overflow-hidden',
        gold ? 'plate-gold' : '',
        emphasis ? 'plate-emphasis' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="plate-sheen pointer-events-none absolute inset-0 rounded-[inherit]" />
      <CornerOrnaments tone={tone} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export function TileIcon({
  label,
  icon,
}: {
  label: string
  /** Module name key or custom React node */
  icon?: ModuleIconKey | React.ReactNode
}) {
  const key = (typeof icon === 'string' ? icon : label) as ModuleIconKey
  const Icon = MODULE_ICONS[key]
  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <div className="tile-icon-well">
        {Icon ? <Icon className="text-[var(--gold)] opacity-90" size={22} /> : icon}
      </div>
      <span className="tile-icon-label">{label}</span>
    </div>
  )
}

/** Compact quest row used on the hub list */
export function QuestRow({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`quest-row ${className}`.trim()}>{children}</div>
}
