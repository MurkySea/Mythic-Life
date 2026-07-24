/** Decorative fantasy frames — pure SVG, no image assets */

export function CornerOrnaments({
  color = 'rgba(212,168,83,0.55)',
}: {
  color?: string
}) {
  return (
    <>
      {/* top-left */}
      <svg className="absolute top-2 left-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none">
        <path d="M1 12V3.5C1 2.12 2.12 1 3.5 1H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M1 7C3 7 5 5 5 3" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      </svg>
      {/* top-right */}
      <svg className="absolute top-2 right-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none">
        <path d="M19 12V3.5C19 2.12 17.88 1 16.5 1H8" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M19 7C17 7 15 5 15 3" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      </svg>
      {/* bottom-left */}
      <svg className="absolute bottom-2 left-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none">
        <path d="M1 8V16.5C1 17.88 2.12 19 3.5 19H12" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M1 13C3 13 5 15 5 17" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.7" />
      </svg>
      {/* bottom-right */}
      <svg className="absolute bottom-2 right-2 w-5 h-5 pointer-events-none" viewBox="0 0 20 20" fill="none">
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
}: {
  children: React.ReactNode
  className?: string
  gold?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background:
          'linear-gradient(160deg, rgba(42,34,68,0.92) 0%, rgba(16,14,28,0.97) 55%, rgba(12,10,22,0.99) 100%)',
        border: gold
          ? '1px solid rgba(212,168,83,0.45)'
          : '1px solid rgba(90,75,130,0.55)',
        boxShadow: gold
          ? '0 0 0 1px rgba(212,168,83,0.12), 0 1px 0 rgba(255,255,255,0.05) inset, 0 20px 48px rgba(0,0,0,0.55)'
          : '0 0 0 1px rgba(120,90,180,0.1), 0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 48px rgba(0,0,0,0.5)',
      }}
    >
      {/* inner glow line */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(212,168,83,0.07) 0%, transparent 28%, transparent 100%)',
        }}
      />
      <CornerOrnaments color={gold ? 'rgba(212,168,83,0.65)' : 'rgba(167,139,250,0.4)'} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export function TileIcon({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px]"
        style={{
          background:
            'linear-gradient(145deg, rgba(60,48,95,0.9) 0%, rgba(28,22,48,0.95) 100%)',
          border: '1px solid rgba(212,168,83,0.25)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 12px rgba(0,0,0,0.35)',
        }}
      >
        {emoji}
      </div>
      <span
        className="text-[11px] font-bold tracking-wide uppercase text-center leading-tight"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
      >
        {label}
      </span>
    </div>
  )
}
