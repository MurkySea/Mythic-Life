/** Consistent dark-fantasy line icons — no emoji */

type IconProps = { className?: string; size?: number }

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconScroll({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} d="M7 4h9a2 2 0 0 1 2 2v13l-2.5-1.5L13 19l-2.5-1.5L8 19V6a2 2 0 0 1 2-2" />
      <path {...stroke} d="M10 8h6M10 12h6M10 16h3" />
    </svg>
  )
}

export function IconSword({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} d="M14.5 4.5l5 5M12 7l5 5M8 11l5 5" />
      <path {...stroke} d="M5 19l4-1 7-7 1-4-4 1-7 7-1 4z" />
      <path {...stroke} d="M5 19l-1.5 1.5" />
    </svg>
  )
}

export function IconMask({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} d="M4 10c0-4 3.5-7 8-7s8 3 8 7v2c0 3-2 5.5-5 6.5-.8.3-1.5-.2-1.5-1v-1.5c0-.6-.4-1-1-1h-2c-.6 0-1 .4-1 1V17.5c0 .8-.7 1.3-1.5 1C6 17.5 4 15 4 12v-2z" />
      <path {...stroke} d="M9 11.5c.3-.5.8-.8 1.5-.8M13.5 10.7c.7 0 1.2.3 1.5.8" />
    </svg>
  )
}

export function IconLetter({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect {...stroke} x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path {...stroke} d="M4 7l8 6 8-6" />
    </svg>
  )
}

export function IconMirror({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <ellipse {...stroke} cx="12" cy="10" rx="5.5" ry="7" />
      <path {...stroke} d="M8 18h8M10 20h4" />
      <path {...stroke} d="M10 7.5c.5-1 1.5-1.5 2.5-1.2" opacity="0.7" />
    </svg>
  )
}

export function IconCodex({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} d="M5 5.5A2.5 2.5 0 0 1 7.5 3H18v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5z" />
      <path {...stroke} d="M5 5.5A2.5 2.5 0 0 1 7.5 3" />
      <path {...stroke} d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}

export function IconScales({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} d="M12 3v16M8 19h8" />
      <path {...stroke} d="M5 8h14" />
      <path {...stroke} d="M7 8l-3 5h6l-3-5zM17 8l-3 5h6l-3-5z" />
    </svg>
  )
}

export function IconTarget({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle {...stroke} cx="12" cy="12" r="8" />
      <circle {...stroke} cx="12" cy="12" r="4.5" />
      <circle {...stroke} cx="12" cy="12" r="1.5" />
    </svg>
  )
}

export function IconMap({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6l5-2z" />
      <path {...stroke} d="M9 4v14M15 6v14" />
    </svg>
  )
}

export function IconQuest({ className = '', size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5.1L12 14.8 7.5 16.8l.9-5.1L4.8 8.2l5-.7L12 3z" />
    </svg>
  )
}

export const MODULE_ICONS = {
  Quests: IconScroll,
  Skills: IconSword,
  Party: IconMask,
  Letters: IconLetter,
  Mirror: IconMirror,
  Codex: IconCodex,
  Standing: IconScales,
  Goals: IconTarget,
  Map: IconMap,
} as const

export type ModuleIconKey = keyof typeof MODULE_ICONS
