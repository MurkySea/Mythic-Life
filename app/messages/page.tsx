import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function sendMessage(formData: FormData) {
  'use server'

  const content = formData.get('content') as string

  if (!content?.trim()) return

  const supabase = await createClient()

  // Save user message
  await supabase.from('messages').insert({
    role: 'user',
    content: content.trim(),
  })

  // Generate Seraphine reply with memory and affinity
  const { generateSeraphineResponse } = await import('../actions')
  await generateSeraphineResponse(content, 'conversation')

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
          <p className="text-zinc-500 text-sm">Conversation</p>
          <h1 className="text-2xl font-medium text-white">
            {companion ? companion.name : 'Messages'}
          </h1>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 min-h-[60vh]">
        {messages && messages.length > 0 ? (
          messages.map((msg: any) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-md'
                }`}
              >
                {msg.role === 'companion' && (
                  <p className="text-violet-400 text-xs font-medium mb-1">
                    {companion?.name || 'Seraphine'}
                  </p>
                )}
                {msg.content}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-16 text-zinc-500 text-sm">
            <p>No messages yet.</p>
            <p className="mt-2">Complete a task and Seraphine will notice.</p>
          </div>
        )}
      </div>

      {/* Reply input */}
      <form action={sendMessage} className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4">
        <div className="flex gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2">
          <input
            type="text"
            name="content"
            placeholder="Reply to Seraphine..."
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            className="bg-violet-600 hover:bg-violet-500 px-6 py-3 rounded-xl text-white font-medium transition"
          >
            Send
          </button>
        </div>
      </form>
    </main>
  )
}