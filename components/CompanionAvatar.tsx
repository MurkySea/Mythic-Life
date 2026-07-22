import {
  resolveChibi,
  resolveHeadshot,
} from '@/lib/staticAvatars'

type Props = {
  slug: string
  name: string
  emoji?: string
  /** DB-stored scene/profile image (fallback if no static file) */
  imageUrl?: string | null
  /** Prefer chibi for small list icons */
  preferChibi?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-10 h-10 text-lg',
  md: 'w-12 h-12 text-xl',
  lg: 'w-14 h-14 text-2xl',
}

export default function CompanionAvatar({
  slug,
  name,
  emoji = '✦',
  imageUrl,
  preferChibi = false,
  size = 'md',
  className = '',
}: Props) {
  const src = preferChibi
    ? resolveChibi(slug, imageUrl)
    : resolveHeadshot(slug, imageUrl)
  const box = sizes[size]

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${box} rounded-full object-cover border border-violet-700/40 shrink-0 bg-zinc-900 ${className}`}
      />
    )
  }

  return (
    <div
      className={`${box} rounded-full bg-violet-900/40 border border-violet-700/40 flex items-center justify-center shrink-0 ${className}`}
      aria-label={name}
    >
      {emoji}
    </div>
  )
}
