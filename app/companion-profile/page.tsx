import { createClient } from '@/utils/supabase/server'

export default async function CompanionProfilePage() {
  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('*')
    .single()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: memories } = await supabase
    .from('messages')
    .select('*')
    .eq('role', 'companion')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <main className="max-w-md mx-auto p-4 space-y-6 pb-24">
      {/* Header with back button */}
      <div className="pt-4 flex items-center gap-3">
        <a 
          href="/" 
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition"
        >
          ←
        </a>
        <div>
          <p className="text-zinc-500 text-sm">Your companion</p>
          <h1 className="text-2xl font-medium text-white">Profile</h1>
        </div>
      </div>

      {companion && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
          {/* Portrait */}
          <div className="flex justify-center">
            {companion.image_url ? (
              <img 
                src={companion.image_url} 
                alt={companion.name} 
                className="w-32 h-32 rounded-2xl object-cover border-2 border-violet-700"
              />
            ) : (
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-6xl">
                🦊
              </div>
            )}
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-medium text-violet-300">{companion.name}</h2>
            <p className="text-zinc-400">{companion.title || 'Quiet Flame'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-zinc-950 rounded-xl p-3">
              <p className="text-xs text-zinc-500">Affinity</p>
              <p className="text-3xl font-medium text-violet-400">{companion.affinity_score}</p>
            </div>
            <div className="bg-zinc-950 rounded-xl p-3">
              <p className="text-xs text-zinc-500">Bond XP</p>
              <p className="text-3xl font-medium text-violet-400">{companion.bond_xp || 0}</p>
            </div>
          </div>

          {/* Personality */}
          <div>
            <p className="text-xs text-zinc-500 mb-2">About her</p>
            <p className="text-zinc-400 leading-relaxed">
              {companion.personality_long || companion.personality}
            </p>
          </div>
        </div>
      )}

      {/* Memories / Highlights */}
      <div>
        <p className="text-xs text-zinc-500 mb-3">Sweet Moments & Memories</p>
        <div className="space-y-3">
          {memories && memories.length > 0 ? (
            memories.map((msg: any) => (
              <div key={msg.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300">
                {msg.content}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-zinc-500 text-sm">
              Complete tasks and talk with her. Sweet moments will appear here.
            </div>
          )}
        </div>
      </div>
    </main>
  )
}