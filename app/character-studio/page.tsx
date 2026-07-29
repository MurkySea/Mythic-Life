import Link from 'next/link'
import { COMPANION_DEFS, getCompanionDef } from '@/lib/companions'
import { getCharacterProfile, type CharacterResponseMove } from '@/lib/characterStudio'
import { SKILL_LABELS } from '@/lib/skills'
import {
  MythicPage,
  MythicPageHeader,
  MythicPanel,
  MythicSectionHeader,
} from '@/components/MythicSurface'

export const dynamic = 'force-dynamic'

const MOVE_LABELS: Record<CharacterResponseMove, string> = {
  react: 'React',
  clarify: 'Clarify',
  comfort: 'Comfort',
  stay: 'Stay quiet',
  challenge: 'Challenge',
  share: 'Share herself',
  tease: 'Tease',
  distract: 'Distract',
  encourage: 'Encourage',
  observe: 'Notice',
  care: 'Practical care',
  protect: 'Protect',
}

const STAGE_LABELS = {
  early: 'Early',
  familiar: 'Familiar',
  trusted: 'Trusted',
  close: 'Close',
  intimate: 'Intimate',
} as const

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'gold' | 'violet' | 'red' }) {
  const toneClass =
    tone === 'gold'
      ? 'border-amber-700/50 bg-amber-950/35 text-amber-200'
      : tone === 'violet'
        ? 'border-violet-700/50 bg-violet-950/35 text-violet-200'
        : tone === 'red'
          ? 'border-red-800/50 bg-red-950/35 text-red-200'
          : 'border-zinc-700/70 bg-zinc-900/70 text-zinc-300'
  return <span className={`rounded-full border px-3 py-1 text-[11px] ${toneClass}`}>{children}</span>
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{value}</p>
    </div>
  )
}

export default async function CharacterStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const params = await searchParams
  const slug = params.c || ''

  if (!slug) {
    return (
      <MythicPage>
        <MythicPageHeader
          eyebrow="Developer codex"
          title="Character Studio"
          subtitle="The versioned conversational source-of-truth for every companion. These profiles now shape live dialogue."
          backHref="/settings"
          backLabel="Settings"
          aside={
            <Link
              href="/messages"
              className="rounded-full border border-violet-700/50 bg-violet-950/40 px-4 py-2 text-xs font-medium text-violet-200"
            >
              Test in Letters
            </Link>
          }
        />

        <MythicPanel tone="violet" emphasis>
          <p className="text-sm leading-relaxed text-zinc-200">
            Each profile defines conversational instincts—not just adjectives. It tells the dialogue engine how she comforts,
            challenges, repairs a misread, flirts, remembers, changes with trust, and fails in specifically human ways.
          </p>
        </MythicPanel>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {COMPANION_DEFS.map((def) => {
            const profile = getCharacterProfile(def)
            return (
              <Link
                href={`/character-studio?c=${def.slug}`}
                key={def.slug}
                className="group rounded-3xl border border-zinc-800 bg-zinc-950/75 p-5 transition hover:border-violet-700/70 hover:bg-violet-950/15"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-700 bg-black/35 text-2xl">
                      {def.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{def.name}</p>
                      <p className="truncate text-xs text-violet-300">{def.title}</p>
                    </div>
                  </div>
                  <span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-violet-300">→</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-zinc-300">{profile.northStar}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {profile.preferredMoves.slice(0, 3).map((move) => (
                    <Chip key={move}>{MOVE_LABELS[move]}</Chip>
                  ))}
                  <Chip tone="gold">{profile.defaultLength}</Chip>
                </div>
              </Link>
            )
          })}
        </div>
      </MythicPage>
    )
  }

  const def = getCompanionDef(slug) || COMPANION_DEFS[0]
  const profile = getCharacterProfile(def)

  return (
    <MythicPage>
      <MythicPageHeader
        eyebrow="Character Studio"
        title={def.name}
        subtitle={`${def.title} · ${def.race} · ${def.className}`}
        backHref="/character-studio"
        backLabel="Roster"
        aside={
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={`/companion-profile?c=${def.slug}`}
              className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-[11px] text-zinc-200"
            >
              Player profile
            </Link>
            <Link
              href={`/messages?c=${def.slug}`}
              className="rounded-full border border-violet-700/60 bg-violet-950/50 px-3 py-2 text-[11px] text-violet-100"
            >
              Test voice
            </Link>
          </div>
        }
      />

      <section className="rounded-[2rem] border border-amber-700/30 bg-gradient-to-br from-amber-950/35 via-zinc-950/85 to-violet-950/30 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-amber-600/35 bg-black/35 text-3xl">
            {def.emoji}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400">Conversational north star</p>
            <h2 className="mt-2 font-[var(--font-display)] text-2xl text-white">{profile.northStar}</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{def.personality}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip tone="gold">{profile.defaultLength} replies</Chip>
          <Chip tone="violet">questions: {profile.questionFrequency}</Chip>
          <Chip>directness {profile.directness}/5</Chip>
          <Chip>temperature {profile.temperature.toFixed(2)}</Chip>
          {def.affinities.map((affinity) => (
            <Chip key={affinity}>{SKILL_LABELS[affinity]}</Chip>
          ))}
        </div>
      </section>

      <div className="mt-8 space-y-8">
        <section>
          <MythicSectionHeader title="Conversation DNA" hint="How she actually behaves in dialogue" sigil="✦" />
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfileField label="Cadence" value={profile.cadence} />
            <ProfileField label="Humor" value={profile.humorStyle} />
            <ProfileField label="Comfort" value={profile.comfortStyle} />
            <ProfileField label="Challenge" value={profile.challengeStyle} />
            <ProfileField label="Repair after a misread" value={profile.repairStyle} />
            <ProfileField label="Flirtation" value={profile.flirtStyle} />
          </div>
        </section>

        <MythicPanel tone="gold">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400">Human friction</p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-200">{profile.humanFriction}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {profile.memoryBlindSpots.map((blindSpot) => (
              <div key={blindSpot} className="rounded-xl border border-amber-900/40 bg-black/20 px-3 py-2 text-xs leading-relaxed text-amber-100/80">
                {blindSpot}
              </div>
            ))}
          </div>
        </MythicPanel>

        <section>
          <MythicSectionHeader title="Response Instincts" hint="One dominant move per message" sigil="◇" />
          <div className="flex flex-wrap gap-2">
            {profile.preferredMoves.map((move, index) => (
              <Chip key={move} tone={index === 0 ? 'violet' : 'neutral'}>
                {index + 1}. {MOVE_LABELS[move]}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <MythicSectionHeader title="Relationship Arc" hint="Familiarity changes behavior—not merely flirtation" sigil="∞" />
          <div className="space-y-3">
            {(Object.keys(STAGE_LABELS) as Array<keyof typeof STAGE_LABELS>).map((stage, index) => (
              <div key={stage} className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:grid-cols-[120px_1fr]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400">Stage {index + 1}</p>
                  <p className="mt-1 font-semibold text-white">{STAGE_LABELS[stage]}</p>
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{profile.stageBehavior[stage]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <MythicPanel tone="blue">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400">What she remembers first</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-200">
              {profile.memoryPriorities.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </MythicPanel>
          <MythicPanel tone="violet">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400">Original character foundation</p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-300"><strong className="text-white">Wounds:</strong> {def.wounds}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300"><strong className="text-white">Opens:</strong> {def.loves}</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300"><strong className="text-white">Closes:</strong> {def.hates}</p>
          </MythicPanel>
        </section>

        <section>
          <MythicSectionHeader title="Calibration" hint="Examples teach better than adjective stacks" sigil="✓" />
          <div className="grid gap-4 sm:grid-cols-2">
            <MythicPanel tone="gold">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Sounds like her</p>
              <div className="mt-4 space-y-3">
                {profile.goodExamples.map((example) => (
                  <blockquote key={example} className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4 text-sm leading-relaxed text-emerald-50">“{example}”</blockquote>
                ))}
              </div>
            </MythicPanel>
            <MythicPanel>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400">AI drift to reject</p>
              <div className="mt-4 space-y-3">
                {profile.avoidExamples.map((example) => (
                  <blockquote key={example} className="rounded-2xl border border-red-900/40 bg-red-950/20 p-4 text-sm leading-relaxed text-red-100/85">“{example}”</blockquote>
                ))}
              </div>
            </MythicPanel>
          </div>
        </section>

        <section>
          <MythicSectionHeader title="Global Drift Guard" hint="Patterns rejected across the entire roster" sigil="×" />
          <div className="flex flex-wrap gap-2">
            {profile.bannedPatterns.map((pattern) => <Chip key={pattern} tone="red">{pattern}</Chip>)}
          </div>
        </section>
      </div>
    </MythicPage>
  )
}
