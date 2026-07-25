'use client'

import { useFormStatus } from 'react-dom'
import { DATE_GOLD_COST } from '@/lib/engines/loot'

function Submit({ hasCoin }: { hasCoin: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full mt-3 px-6 py-2.5 rounded-xl text-sm font-medium transition active:scale-95 ${
        pending
          ? 'bg-amber-900/60 text-amber-200/70 cursor-wait'
          : 'bg-amber-700/90 hover:bg-amber-600 text-amber-50'
      }`}
    >
      {pending
        ? 'Getting ready…'
        : hasCoin
          ? 'Take on a date · 1 date coin'
          : `Take on a date · ${DATE_GOLD_COST} gold`}
    </button>
  )
}

export default function TakeOnDateButton({
  slug,
  gold,
  dateCoins = 0,
  action,
}: {
  slug: string
  gold: number
  dateCoins?: number
  action: (formData: FormData) => Promise<void>
}) {
  const hasCoin = dateCoins >= 1
  const canAfford = hasCoin || gold >= DATE_GOLD_COST

  return (
    <div className="w-full mt-2">
      <p className="text-[11px] text-zinc-500 text-center leading-relaxed px-2">
        Spend a date coin or gold on a night out — not a transaction. She dresses up; you both get the memory.
        <span className="block mt-1 text-zinc-600">
          {dateCoins > 0 ? `${dateCoins} date coin${dateCoins === 1 ? '' : 's'} · ` : ''}
          {Math.floor(gold)} gold
        </span>
      </p>
      {canAfford ? (
        <form action={action}>
          <input type="hidden" name="slug" value={slug} />
          <Submit hasCoin={hasCoin} />
        </form>
      ) : (
        <p className="mt-3 text-center text-xs text-zinc-600">
          Need a date coin or {DATE_GOLD_COST} gold · muster & quests
        </p>
      )}
    </div>
  )
}
