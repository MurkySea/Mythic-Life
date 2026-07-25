/**
 * Gallery image kinds: affinity scenes vs date nights vs muster specials.
 *
 * Supabase (run once):
 *   alter table gallery_images add column if not exists kind text not null default 'scene';
 *   update gallery_images set kind = 'date'
 *     where prompt_used like '[[kind:date]]%'
 *        or prompt_used like '[Muster%'
 *        or (prompt_used like '[%' and prompt_used not like '[[kind:scene]]%');
 */

export type GalleryKind = 'scene' | 'date' | 'muster'

export function markPrompt(kind: GalleryKind, prompt: string): string {
  return `[[kind:${kind}]] ${prompt}`
}

export function isAffinitySceneRow(row: {
  kind?: string | null
  prompt_used?: string | null
}): boolean {
  if (row.kind === 'scene') return true
  if (row.kind === 'date' || row.kind === 'muster') return false

  const p = (row.prompt_used || '').trimStart()
  if (p.startsWith('[[kind:scene]]')) return true
  if (p.startsWith('[[kind:date]]') || p.startsWith('[[kind:muster]]')) return false
  // Older date/muster rows used a single [Title] prefix
  if (p.startsWith('[')) return false
  // Legacy affinity scenes — no kind marker
  return true
}

/** Insert gallery row; falls back if `kind` column is missing. */
export async function insertGalleryImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: {
    character_name: string
    image_url: string
    affinity_at_generation?: number | null
    prompt_used: string
    kind: GalleryKind
  }
): Promise<void> {
  const withKind = {
    character_name: row.character_name,
    image_url: row.image_url,
    affinity_at_generation: row.affinity_at_generation ?? null,
    prompt_used: markPrompt(row.kind, row.prompt_used.replace(/^\[\[kind:\w+\]\]\s*/, '')),
    kind: row.kind,
  }

  const { error } = await supabase.from('gallery_images').insert(withKind)
  if (!error) return

  // Column missing — insert without kind (prompt marker still encodes type)
  const { kind: _k, ...withoutKind } = withKind
  const { error: err2 } = await supabase.from('gallery_images').insert(withoutKind)
  if (err2) console.error('insertGalleryImage failed', err2)
}
