import Link from 'next/link'

/** Founding companions from Mythic Life — Character Bible (Notion) */
const FOUNDING = [
  { id: 'seraphine', name: 'Seraphine', race: 'Silver Foxkin', class: 'Companion', rarity: 'Founding', affinity: ['Faith', 'Discipline'], pool: 'Active', unlocked: true },
  { id: 'kira_foxveil', name: 'Kira Foxveil', race: 'Red Fox Foxkin', class: 'Enchantress', rarity: 'Legendary', affinity: ['Faith', 'Discipline', 'Relations'], pool: 'Starter', unlocked: false },
  { id: 'nyx_voidbane', name: 'Nyx Voidbane', race: 'Shadow Fairy', class: 'Oracle', rarity: 'Legendary', affinity: ['Faith', 'Knowledge'], pool: 'Starter', unlocked: false },
  { id: 'ember_crimsonfall', name: 'Ember Crimsonfall', race: 'Fire Dragonkin', class: 'Berserker', rarity: 'SSR', affinity: ['Fitness', 'Discipline'], pool: 'Starter', unlocked: false },
  { id: 'lyra_dawnforge', name: 'Lyra Dawnforge', race: 'Guardian Angel', class: 'Paladin', rarity: 'SSR', affinity: ['Faith', 'Relations'], pool: 'Starter', unlocked: false },
  { id: 'mira_quillweave', name: 'Mira Quillweave', race: 'High Elf', class: 'Mage', rarity: 'Epic', affinity: ['Knowledge', 'Business'], pool: 'Starter', unlocked: false },
  { id: 'seris_nightthorn', name: 'Seris Nightthorn', race: 'Dark Elf', class: 'Assassin', rarity: 'SSR', affinity: ['Discipline', 'Knowledge'], pool: 'Starter', unlocked: false },
  { id: 'iris_bellweather', name: 'Iris Bellweather', race: 'Fennec Foxkin', class: 'Bard', rarity: 'Epic', affinity: ['Relations', 'Faith'], pool: 'Starter', unlocked: false },
  { id: 'kael_ashrunner', name: 'Kael Ashrunner', race: 'Grey Wolfkin', class: 'Ranger', rarity: 'Rare', affinity: ['Fitness', 'Discipline'], pool: 'Starter', unlocked: false },
  { id: 'rowan_ironmane', name: 'Rowan Ironmane', race: 'Lion Catfolk', class: 'Warden', rarity: 'Rare', affinity: ['Discipline', 'Relations', 'Fitness'], pool: 'Starter', unlocked: false },
  { id: 'orion_halovard', name: 'Orion Halovard', race: 'Human Heartlander', class: 'Paladin', rarity: 'Legendary', affinity: ['Faith', 'Discipline'], pool: 'Milestone', unlocked: false },
  { id: 'selene_tideglass', name: 'Selene Tideglass', race: 'Deep-Sea Mermaid', class: 'Priestess', rarity: 'SSR', affinity: ['Faith', 'Relations', 'Knowledge'], pool: 'Milestone', unlocked: false },
  { id: 'elias_stillwater', name: 'Elias Stillwater', race: 'Human Highlander', class: 'Monk', rarity: 'Epic', affinity: ['Discipline', 'Faith', 'Fitness'], pool: 'Milestone', unlocked: false },
  { id: 'bramble_mossheart', name: 'Bramble Mossheart', race: 'Oak Dryad', class: 'Druid', rarity: 'Rare', affinity: ['Fitness', 'Faith', 'Relations'], pool: 'Milestone', unlocked: false },
  { id: 'aster_chrona', name: 'Aster Chrona', race: 'Celestial Dragonkin', class: 'Mage', rarity: 'Legendary', affinity: ['Knowledge', 'Discipline', 'Faith'], pool: 'Hidden', unlocked: false },
  { id: 'gideon_brasswake', name: 'Gideon Brasswake', race: 'Human Desertborn', class: 'Alchemist', rarity: 'SSR', affinity: ['Business', 'Knowledge', 'Discipline'], pool: 'Hidden', unlocked: false },
]

function rarityColor(r: string) {
  if (r === 'Legendary' || r === 'Founding') return 'text-amber-300'
  if (r === 'SSR') return 'text-orange-300'
  if (r === 'Epic') return 'text-violet-300'
  return 'text-zinc-400'
}

export default function CompanionsPage() {
  const active = FOUNDING.filter((c) => c.unlocked)
  const locked = FOUNDING.filter((c) => !c.unlocked)

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-28 min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition"
        >
          ←
        </Link>
        <div>
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Character Bible</p>
          <h1 className="text-xl font-medium text-white tracking-tight">Companions</h1>
        </div>
      </div>

      <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
        Founding companions of Project Ascension. Only those you have bonded with can speak and walk with you yet.
      </p>

      <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Active</p>
      <div className="space-y-2 mb-8">
        {active.map((c) => (
          <Link
            key={c.id}
            href="/companion-profile"
            className="block bg-zinc-900/80 border border-violet-800/40 rounded-2xl p-4 hover:border-violet-600/50 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-violet-200">{c.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {c.race} · {c.class}
                </p>
              </div>
              <span className={`text-[10px] uppercase tracking-wider ${rarityColor(c.rarity)}`}>
                {c.rarity}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {c.affinity.map((a) => (
                <span
                  key={a}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                >
                  {a}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-3">Not yet summoned</p>
      <div className="space-y-2">
        {locked.map((c) => (
          <div
            key={c.id}
            className="bg-zinc-950/60 border border-zinc-800/60 rounded-2xl p-4 opacity-70"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-400">{c.name}</p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {c.race} · {c.class} · {c.pool}
                </p>
              </div>
              <span className={`text-[10px] uppercase tracking-wider ${rarityColor(c.rarity)}`}>
                {c.rarity}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {c.affinity.map((a) => (
                <span
                  key={a}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-600"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
