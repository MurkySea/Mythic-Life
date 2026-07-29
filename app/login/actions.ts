'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '/'
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const next = safeNext(formData.get('next'))

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent('Enter your email and password.')}&next=${encodeURIComponent(next)}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent('That email or password was not accepted.')}&next=${encodeURIComponent(next)}`)
  }

  redirect(next)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
