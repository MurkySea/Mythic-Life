'use client'

import { useFormStatus } from 'react-dom'

function ClaimButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${
        pending
          ? 'bg-amber-900/50 text-amber-200/60 cursor-wait'
          : 'bg-amber-600 hover:bg-amber-500 text-amber-50'
      }`}
    >
      {pending ? 'Opening…' : 'Claim muster'}
    </button>
  )
}

export default function MusterCard({
  claimed,
  streak,
  dateCoins,
  action,
}: {
  claimed: boolean
  streak: number
  dateCoins: number
  action: (formData: FormData) => void | Promise<void>
}) {
  // Once claimed, the banner disappears completely
  if (claimed) return null

  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{
        background: 'linear-gradient(180deg, #2a1f0a 0%, #1a1408 100%)',
        borderColor: 'rgba(212,168,83,0.45)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-bold tracking-[0.14em] uppercase"
            style={{ color: 'var(--gold)' }}
          >
            Daily muster
          </p>
          <p className="mt-1 text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
            Show up. Roll the table.
          </p>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
            Gold · Date coin · Special night · Ultra Angel
            {streak > 0 ? ` · ${streak} day streak` : ''}
            {dateCoins > 0
              ? ` · ${dateCoins} date coin${dateCoins === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
        <form action={action}>
          <ClaimButton />
        </form>
      </div>
    </div>
  )
}
