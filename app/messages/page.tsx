import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function sendMessage(formData: FormData) {
  'use server'

  const content = formData.get('content') as string

  if (!content?.trim()) return

  const supabase = await createClient()

  await supabase.from('messages').insert({
    role: 'user',
    content: content.trim(),
  })

  const { generateSeraphineResponse } = await import('../actions')
  await generateSeraphineResponse(content.trim(), 'conversation', {
    force: true,
    isConversation: true,
  })

  revalidatePath('/messages')
  revalidatePath('/companion')
  revalidatePath('/')
}

export default async function MessagesPage() {
  const supabase = await createClient()

  const { data: companion } = await supabase
    .from('companion')
    .select('*')
    .single()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <main className="max-w-md mx-auto px-4 pt-6 pb-32 min-h-screen">
      <div className="flex items-center gap-3 mb-8">
        <a
          href="/"
          className="w-10 h-10 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition"
        >
          ←
        </a>
        <div>
          <p className="text-zinc-500 text-xs tracking-wide uppercase">Conversation</p>
          <h1 className="text-xl font-medium text-white tracking-tight">
            {companion ? companion.name : 'Messages'}
          </h1>
        </div>
      </div>

      <div className="space-y-5">
        {messages && messages.length > 0 ? (
          messages.map((msg: any) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-zinc-900/90 border border-zinc-800/80 text-zinc-200 rounded-bl-md'
                }`}
              >
                {msg.role === 'companion' && (
                  <p className="text-violet-400/90 text-[11px] font-medium mb-1.5 tracking-wide">
                    {companion?.name || 'Seraphine'}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-24 text-zinc-500">
            <p className="text-sm">No messages yet.</p>
            <p className="mt-2 text-xs text-zinc-600">Talk to her, or complete a task — she notices when it matters.</p>
          </div>
        )}
      </div>

      <form action={sendMessage} className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 z-40">
        <div className="flex gap-2 items-center bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-1.5 shadow-lg shadow-black/40">
          <input
            type="text"
            name="content"
            placeholder="Reply to Seraphine..."
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-zinc-500 text-[15px] focus:outline-none"
          />
          <button
            type="submit"
            className="bg-violet-600 hover:bg-violet-500 active:scale-95 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  )
}
