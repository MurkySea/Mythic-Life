'use server'

import { revalidatePath } from 'next/cache'
import {
  enterVacation,
  enterRecovery,
  exitRestMode,
  advanceDay,
} from '@/lib/engines/vacation'
import {
  joinParty,
  leaveParty,
  setLeader,
  setPartyLocked,
  createEmptyParty,
} from '@/lib/engines/party'
import {
  loadPlayerState,
  saveModeState,
  savePartyState,
} from '@/lib/player-state'

function revalidateModePaths() {
  revalidatePath('/settings')
  revalidatePath('/companions')
  revalidatePath('/companion-profile')
  revalidatePath('/')
}

// ─── Vacation / Recovery ───────────────────────────────────

export async function actionEnterVacation(_formData: FormData) {
  const { mode } = await loadPlayerState()
  const { mode: next } = enterVacation(mode)
  await saveModeState(next)
  revalidateModePaths()
}

export async function actionEnterRecovery(_formData: FormData) {
  const { mode } = await loadPlayerState()
  const { mode: next } = enterRecovery(mode)
  await saveModeState(next)
  revalidateModePaths()
}

export async function actionExitRestMode(_formData: FormData) {
  const { mode } = await loadPlayerState()
  if (mode.mode !== 'vacation' && mode.mode !== 'recovery') return
  const { mode: next } = exitRestMode(mode)
  await saveModeState(next)
  revalidateModePaths()
}

/** Call once per real calendar day (can be hooked to cron or manual). */
export async function actionAdvanceDay(_formData: FormData) {
  const state = await loadPlayerState()
  const { mode: nextMode } = advanceDay(state.mode)
  await saveModeState(nextMode)
  revalidateModePaths()
}

// ─── Active Party ──────────────────────────────────────────

export async function actionJoinParty(formData: FormData) {
  const slug = String(formData.get('slug') || '').trim()
  if (!slug) return

  const { party } = await loadPlayerState()
  const next = joinParty(party, slug)
  if (!next) return
  await savePartyState(next)
  revalidateModePaths()
}

export async function actionLeaveParty(formData: FormData) {
  const slug = String(formData.get('slug') || '').trim()
  if (!slug) return

  const { party } = await loadPlayerState()
  const next = leaveParty(party, slug)
  if (!next) return
  await savePartyState(next)
  revalidateModePaths()
}

export async function actionSetLeader(formData: FormData) {
  const slug = String(formData.get('slug') || '').trim()
  if (!slug) return

  const { party } = await loadPlayerState()
  const next = setLeader(party, slug)
  if (!next) return
  await savePartyState(next)
  revalidateModePaths()
}

export async function actionTogglePartyLock(_formData: FormData) {
  const { party } = await loadPlayerState()
  const next = setPartyLocked(party, !party.locked)
  await savePartyState(next)
  revalidateModePaths()
}

export async function actionResetParty(_formData: FormData) {
  await savePartyState(createEmptyParty())
  revalidateModePaths()
}
