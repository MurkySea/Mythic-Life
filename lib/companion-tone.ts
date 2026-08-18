export type CompanionTone =
  | 'silver'
  | 'ember'
  | 'crimson'
  | 'void'
  | 'archive'
  | 'dawn'
  | 'wild'
  | 'tide'
  | 'rose'
  | 'violet'

const TONES: Record<string, CompanionTone> = {
  // Legacy starter key now represents Elowen.
  seraphine: 'silver',
  seraphine_quietflame: 'silver',
  kira_foxveil: 'crimson',
  ember_crimsonfall: 'ember',
  nyx_voidbane: 'void',
  mira_quillweave: 'archive',
  lyra_dawnforge: 'dawn',
  kael_ashrunner: 'wild',
  selene_tideglass: 'tide',
  iris_bellweather: 'rose',
}

export function companionTone(slug: string | null | undefined): CompanionTone {
  return TONES[String(slug || '').toLowerCase()] || 'violet'
}
