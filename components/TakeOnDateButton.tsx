'use client'

import { useFormStatus } from 'react-dom'
import { DATE_GOLD_COST } from '@/lib/engines/loot'

function Submit() {
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
      {pending ? 'Getting ready…' : `Take on a date · ${DATE_GOLD_COST} gold`}
    </button>
  )
}

export default function TakeOnDateButton({
  slug,
  gold,
  action,
}: {
  slug: string
  gold: number
  action: (formData: FormData) => Promise<void>
}) {
  const canAfford = gold >= DATE_GOLD_COST

  return (
    <div className="w-full mt-2">
      <p className="text-[11px] text-zinc-500 text-center leading-relaxed px-2">
        Spend gold on a night out — not a transaction. She dresses up; you both get the memory.
        <span className="block mt-1 text-zinc-600">You have {Math.floor(gold)} gold</span>
      </p>
      {canAfford ? (
        <form action={action}>
          <input type="hidden" name="slug" value={slug} />
          <Submit />
        </form>
      ) : (
        <p className="mt-3 text-center text-xs text-zinc-600">
          Need {DATE_GOLD_COST} gold · complete quests for loot
        </p>
      )}
    </div>
  )
}
