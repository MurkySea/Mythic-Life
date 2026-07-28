import type { ReactNode } from 'react'

/** Cohesive dark-fantasy line icons — no platform emoji. */

export type IconProps = { className?: string; size?: number }

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Svg({ children, className = '', size = 22 }: IconProps & { children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>{children}</svg>
}

export function IconScroll(props: IconProps) { return <Svg {...props}><path {...stroke} d="M7 4h9a2 2 0 0 1 2 2v13l-2.5-1.5L13 19l-2.5-1.5L8 19V6a2 2 0 0 1 2-2" /><path {...stroke} d="M10 8h6M10 12h6M10 16h3" /></Svg> }
export function IconSword(props: IconProps) { return <Svg {...props}><path {...stroke} d="M14.5 4.5l5 5M12 7l5 5M8 11l5 5" /><path {...stroke} d="M5 19l4-1 7-7 1-4-4 1-7 7-1 4z" /><path {...stroke} d="M5 19l-1.5 1.5" /></Svg> }
export function IconCrossedSwords(props: IconProps) { return <Svg {...props}><path {...stroke} d="M5 4l6.5 6.5M8 3l-4 4M6.5 14.5L3 18l3 3 3.5-3.5" /><path {...stroke} d="M19 4l-6.5 6.5M16 3l4 4M17.5 14.5L21 18l-3 3-3.5-3.5" /><path {...stroke} d="M9 12l6 6M15 12l-6 6" /></Svg> }
export function IconMask(props: IconProps) { return <Svg {...props}><path {...stroke} d="M4 10c0-4 3.5-7 8-7s8 3 8 7v2c0 3-2 5.5-5 6.5-.8.3-1.5-.2-1.5-1v-1.5c0-.6-.4-1-1-1h-2c-.6 0-1 .4-1 1V17.5c0 .8-.7 1.3-1.5 1C6 17.5 4 15 4 12v-2z" /><path {...stroke} d="M9 11.5c.3-.5.8-.8 1.5-.8M13.5 10.7c.7 0 1.2.3 1.5.8" /></Svg> }
export function IconLetter(props: IconProps) { return <Svg {...props}><rect {...stroke} x="3.5" y="6" width="17" height="12" rx="1.5" /><path {...stroke} d="M4 7l8 6 8-6" /></Svg> }
export function IconMirror(props: IconProps) { return <Svg {...props}><ellipse {...stroke} cx="12" cy="10" rx="5.5" ry="7" /><path {...stroke} d="M8 18h8M10 20h4" /><path {...stroke} d="M10 7.5c.5-1 1.5-1.5 2.5-1.2" opacity="0.7" /></Svg> }
export function IconCodex(props: IconProps) { return <Svg {...props}><path {...stroke} d="M5 5.5A2.5 2.5 0 0 1 7.5 3H18v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5z" /><path {...stroke} d="M5 5.5A2.5 2.5 0 0 1 7.5 3M9 8h6M9 12h6M9 16h3" /></Svg> }
export function IconScales(props: IconProps) { return <Svg {...props}><path {...stroke} d="M12 3v16M8 19h8M5 8h14" /><path {...stroke} d="M7 8l-3 5h6L7 8zM17 8l-3 5h6l-3-5z" /></Svg> }
export function IconTarget(props: IconProps) { return <Svg {...props}><circle {...stroke} cx="12" cy="12" r="8" /><circle {...stroke} cx="12" cy="12" r="4.5" /><circle {...stroke} cx="12" cy="12" r="1.5" /></Svg> }
export function IconMap(props: IconProps) { return <Svg {...props}><path {...stroke} d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6l5-2zM9 4v14M15 6v14" /></Svg> }
export function IconQuest(props: IconProps) { return <Svg {...props}><path {...stroke} d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5.1L12 14.8 7.5 16.8l.9-5.1L4.8 8.2l5-.7L12 3z" /></Svg> }
export function IconCalendar(props: IconProps) { return <Svg {...props}><rect {...stroke} x="4" y="5.5" width="16" height="14" rx="2" /><path {...stroke} d="M8 3v5M16 3v5M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" /></Svg> }
export function IconCrown(props: IconProps) { return <Svg {...props}><path {...stroke} d="M4 8l4 4 4-7 4 7 4-4-2 10H6L4 8zM7 21h10" /></Svg> }
export function IconCoins(props: IconProps) { return <Svg {...props}><ellipse {...stroke} cx="9" cy="7" rx="5" ry="2.5" /><path {...stroke} d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7M4 11v4c0 1.4 2.2 2.5 5 2.5 1 0 1.9-.1 2.7-.4" /><path {...stroke} d="M14 12.5c3.3 0 6 1.1 6 2.5s-2.7 2.5-6 2.5-6-1.1-6-2.5M8 15v3c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-3" /></Svg> }
export function IconHeartKnot(props: IconProps) { return <Svg {...props}><path {...stroke} d="M12 20s-8-4.6-8-10.2C4 6.5 6.2 5 8.4 5c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2C17.8 5 20 6.5 20 9.8 20 15.4 12 20 12 20z" /><path {...stroke} d="M8.5 11.5h7M10 9.5l4 4" opacity=".75" /></Svg> }
export function IconPartyBanner(props: IconProps) { return <Svg {...props}><path {...stroke} d="M5 21V4M5 5h12l-2 3 2 3H5" /><circle {...stroke} cx="9" cy="15" r="2" /><circle {...stroke} cx="15" cy="15" r="2" /><path {...stroke} d="M6.5 20c.6-2 1.4-3 2.5-3s1.9 1 2.5 3M12.5 20c.6-2 1.4-3 2.5-3s1.9 1 2.5 3" /></Svg> }
export function IconChest(props: IconProps) { return <Svg {...props}><path {...stroke} d="M4 10h16v9H4zM5 10V8a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M4 13h16" /><rect {...stroke} x="10" y="11.5" width="4" height="4" rx=".7" /></Svg> }
export function IconGallery(props: IconProps) { return <Svg {...props}><rect {...stroke} x="4" y="4" width="16" height="16" rx="2" /><circle {...stroke} cx="9" cy="9" r="1.5" /><path {...stroke} d="M5 17l4.5-4 3 2.5 2.5-2 4 3.5" /></Svg> }
export function IconBell(props: IconProps) { return <Svg {...props}><path {...stroke} d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5L6 17zM10 20h4" /></Svg> }
export function IconCog(props: IconProps) { return <Svg {...props}><circle {...stroke} cx="12" cy="12" r="3" /><path {...stroke} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /><circle {...stroke} cx="12" cy="12" r="7" /></Svg> }
export function IconFlame(props: IconProps) { return <Svg {...props}><path {...stroke} d="M13 3c1 4-2 4.5-1 8 1.5-1.5 2.5-3 2.5-4.5C18 9 20 12 19 16a7 7 0 0 1-14 0c0-3 1.5-5.5 4.5-8-.2 3 1.2 4.5 2.5 5.5" /></Svg> }
export function IconSpark(props: IconProps) { return <Svg {...props}><path {...stroke} d="M12 3l1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3zM18.5 16l.6 2.4 2.4.6-2.4.6-.6 2.4-.6-2.4-2.4-.6 2.4-.6.6-2.4z" /></Svg> }
export function IconPlusRune(props: IconProps) { return <Svg {...props}><circle {...stroke} cx="12" cy="12" r="8" /><path {...stroke} d="M12 8v8M8 12h8" /></Svg> }
export function IconPath(props: IconProps) { return <Svg {...props}><path {...stroke} d="M5 19c0-3 2-4 5-5s5-2 5-5c0-2-1-3-3-4M4 5h5M15 19h5" /><circle {...stroke} cx="4" cy="5" r="1.5" /><circle {...stroke} cx="20" cy="19" r="1.5" /></Svg> }

export const MYTHIC_ICONS = {
  quest: IconScroll, skills: IconSword, party: IconPartyBanner, messages: IconLetter,
  profile: IconMirror, settings: IconCog, standing: IconScales, goals: IconTarget,
  map: IconMap, calendar: IconCalendar, rewards: IconChest, gallery: IconGallery,
  notifications: IconBell, currency: IconCoins, relationship: IconHeartKnot,
  streak: IconFlame, achievement: IconCrown, add: IconPlusRune, plan: IconPath,
  primaryQuest: IconCrossedSwords, spark: IconSpark,
} as const

export type MythicIconName = keyof typeof MYTHIC_ICONS
export function MythicIcon({ name, ...props }: IconProps & { name: MythicIconName }) {
  const Icon = MYTHIC_ICONS[name]
  return <Icon {...props} />
}

export const MODULE_ICONS = {
  Quests: IconScroll, Skills: IconSword, Party: IconPartyBanner, Letters: IconLetter,
  Mirror: IconMirror, Codex: IconCog, Standing: IconScales, Goals: IconTarget, Map: IconMap,
} as const

export type ModuleIconKey = keyof typeof MODULE_ICONS
