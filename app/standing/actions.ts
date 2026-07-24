'use server'

import { revalidatePath } from 'next/cache'
import { spendTokens, loadStanding, saveStanding } from '@/lib/engines/standing-store'
import { getSink } from '@/lib/engines/sinks'

export async function buySink(formData: FormData) {
  const id = String(formData.get('sink_id') || '')
  const sink = getSink(id)
  if (!sink) return

  const ok = await spendTokens(sink.cost)
  if (!ok) return

  // Shadow relief actually reduces debt a little
  if (sink.id === 'debt_relief') {
    const cur = await loadStanding()
    await saveStanding({
      shadow_debt: Math.max(0, Number((cur.shadow_debt - 5).toFixed(1))),
    })
  }

  revalidatePath('/standing')
  revalidatePath('/')
}
