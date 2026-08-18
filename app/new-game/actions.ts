'use server'

import { redirect } from 'next/navigation'
import { hardResetGame } from '@/app/dev-actions'

export async function startNewGame(formData: FormData): Promise<void> {
  await hardResetGame(formData)
  redirect('/')
}
