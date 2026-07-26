/**
 * Mythic Life – Player State (Mode + Active Party)
 * Loads / saves ModeState and PartyState from the player_state table.
 */

import { createClient } from '@/utils/supabase/server'
import {
  createInitialModeState,
  type ModeState,
  type SystemMode,
} from '@/lib/engines/vacation'
import {
  createEmptyParty,
  type PartyState,
  type PartyMember,
  MAX_PARTY_SIZE,
} from '@/lib/engines/party'

export type PlayerState = {
  mode: ModeState
  party: PartyState
}

const DEFAULT_MODE = createInitialModeState()
const DEFAULT_PARTY = createEmptyParty()

export async function loadPlayerState(): Promise<PlayerState> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('player_state')
      .select('mode_state, party_state')
      .eq('id', 'main')
      .maybeSingle()

    if (error || !data) {
      return { mode: DEFAULT_MODE, party: DEFAULT_PARTY }
    }

    const mode = (data.mode_state as ModeState) || DEFAULT_MODE
    const party = (data.party_state as PartyState) || DEFAULT_PARTY

    // Basic shape safety
    if (!mode.mode) mode.mode = 'normal'
    if (!Array.isArray(party.members)) party.members = []

    return { mode, party }
  } catch {
    return { mode: DEFAULT_MODE, party: DEFAULT_PARTY }
  }
}

export async function savePlayerState(state: PlayerState): Promise<void> {
  const supabase = await createClient()
  await supabase.from('player_state').upsert({
    id: 'main',
    mode_state: state.mode,
    party_state: state.party,
    updated_at: new Date().toISOString(),
  })
}

export async function saveModeState(mode: ModeState): Promise<void> {
  const current = await loadPlayerState()
  await savePlayerState({ ...current, mode })
}

export async function savePartyState(party: PartyState): Promise<void> {
  const current = await loadPlayerState()
  await savePlayerState({ ...current, party })
}

export { MAX_PARTY_SIZE }
export type { ModeState, SystemMode, PartyState, PartyMember }
