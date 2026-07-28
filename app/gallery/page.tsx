import { createClient, hasSupabaseEnv } from '@/utils/supabase/server'
import Link from 'next/link'
import { getIntimacyLabel } from '@/lib/scenes'
import { getCompanionDef } from '@/lib/companions'
import { companionTone } from '@/lib/companion-tone'
import { MythicIcon } from '@/components/MythicIcons'
import GalleryGrid, { type GalleryImage } from '@/components/GalleryGrid'
import { setAsAvatar, clearAvatar } from '@/app/avatar-actions'
import styles from './gallery.module.css'

export const dynamic = 'force-dynamic'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string }>
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className={styles.config}>
        <h1 className={styles.configTitle}>The Memory Vault is sealed</h1>
        <p className={styles.configText}>Supabase environment configuration is missing on this deployment.</p>
      </main>
    )
  }

  const params = await searchParams
  const supabase = await createClient()

  const { data: allImages } = await supabase
    .from('gallery_images')
    .select('character_name')
    .order('created_at', { ascending: false })

  const characters = Array.from(new Set((allImages || []).map((image) => image.character_name)))
  const activeCharacter = params.character || characters[0] || 'Seraphine'

  const [{ data: images }, { data: companion }] = await Promise.all([
    supabase
      .from('gallery_images')
      .select('*')
      .eq('character_name', activeCharacter)
      .order('created_at', { ascending: false }),
    supabase
      .from('companion')
      .select('image_url, name, slug')
      .eq('name', activeCharacter)
      .maybeSingle(),
  ])

  const currentAvatarUrl = companion?.image_url || null
  const activeSlug =
    companion?.slug ||
    (activeCharacter === 'Seraphine'
      ? 'seraphine'
      : activeCharacter.toLowerCase().replace(/\s+/g, '_'))
  const activeDef = getCompanionDef(activeSlug)
  const tone = companionTone(activeSlug)

  const prepared: GalleryImage[] = (images || []).map(
    (image: {
      id: string
      image_url: string
      character_name: string
      affinity_at_generation?: number | null
      created_at: string
    }) => ({
      id: image.id,
      image_url: image.image_url,
      character_name: image.character_name,
      affinity_at_generation: image.affinity_at_generation,
      created_at: image.created_at,
      intimacyLabel:
        image.affinity_at_generation != null
          ? getIntimacyLabel(image.affinity_at_generation)
          : undefined,
    })
  )

  return (
    <main className={styles.page}>
      <div className={styles.auraGold} aria-hidden />
      <div className={styles.auraBlue} aria-hidden />
      <div className={styles.auraRose} aria-hidden />
      <div className={styles.dust} aria-hidden />

      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <Link href="/" className={styles.backLink}>
            <span className={styles.backGlyph} aria-hidden>‹</span>
            Return to command
          </Link>
          <p className={styles.eyebrow}>Collected moments</p>
          <h1 className={styles.title}>The Memory Vault</h1>
          <p className={styles.subtitle}>
            Images created inside the relationship are kept here as relics of a particular moment, bond, and version of the world.
          </p>
        </div>
        <Link href="/companion-profile" className={styles.profileLink}>
          <span className={styles.profileIcon} aria-hidden><MythicIcon name="profile" size={13} /></span>
          Profiles
        </Link>
      </header>

      {characters.length > 0 ? (
        <>
          <section className={styles.vault} data-tone={tone}>
            <div className={styles.vaultSigil} aria-hidden>{activeCharacter.slice(0, 1)}</div>
            <div className={styles.vaultCopy}>
              <p className={styles.vaultKicker}>Open collection</p>
              <h2 className={styles.vaultName}>{activeCharacter}</h2>
              <p className={styles.vaultTitle}>{activeDef?.title || 'Companion archive'}</p>
              <p className={styles.vaultMeta}>
                {currentAvatarUrl
                  ? 'One memory currently serves as her living portrait.'
                  : 'No custom portrait has been chosen from this collection.'}
              </p>
            </div>
            <div className={styles.vaultCount} aria-label={`${prepared.length} collected memories`}>
              <div>
                <p className={styles.countValue}>{prepared.length}</p>
                <p className={styles.countLabel}>Memories</p>
              </div>
            </div>
          </section>

          <nav className={styles.characterRail} aria-label="Companion memory collections">
            {characters.map((name) => (
              <Link
                key={name}
                href={`/gallery?character=${encodeURIComponent(name)}`}
                className={`${styles.characterLink} ${activeCharacter === name ? styles.characterActive : ''}`}
              >
                <span className={styles.characterSigil} aria-hidden>{name.slice(0, 1)}</span>
                {name}
              </Link>
            ))}
          </nav>

          {prepared.length > 0 ? (
            <>
              <p className={styles.instruction}>
                <span className={styles.instructionIcon} aria-hidden><MythicIcon name="gallery" size={13} /></span>
                Open a framed memory to view it fully or choose it as the companion&apos;s current portrait.
              </p>
              <GalleryGrid
                images={prepared}
                tone={tone}
                currentAvatarUrl={currentAvatarUrl}
                setAvatarAction={setAsAvatar}
                clearAvatarAction={clearAvatar}
              />
            </>
          ) : (
            <section className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden><MythicIcon name="gallery" size={25} /></div>
              <h2 className={styles.emptyTitle}>This chamber has no memories yet</h2>
              <p className={styles.emptyText}>
                Ask {activeCharacter} to show you a moment from your current scene. When she creates it, the image will be preserved here.
              </p>
              <Link href={`/messages?c=${encodeURIComponent(activeSlug)}`} className={styles.emptyLink}>
                Enter correspondence
              </Link>
            </section>
          )}
        </>
      ) : (
        <section className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden><MythicIcon name="gallery" size={25} /></div>
          <h2 className={styles.emptyTitle}>The vault is waiting for its first relic</h2>
          <p className={styles.emptyText}>
            Generated companion images will gather here once a scene becomes worth preserving.
          </p>
          <Link href="/companions" className={styles.emptyLink}>Visit the party</Link>
        </section>
      )}
    </main>
  )
}
