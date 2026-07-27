import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/** Standard RLS-aware client (anon key). Use for normal reads/writes. */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'MISSING_SUPABASE_ENV: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables (Production + Preview), then Redeploy.'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — safe to ignore when middleware refreshes sessions.
        }
      },
    },
  })
}

/**
 * Service-role client — bypasses RLS.
 * ONLY use on the server for privileged operations (e.g. Storage uploads).
 * Never import this into client components or expose the key.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'MISSING_SERVICE_ROLE: Set SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables (Production + Preview). This key is server-only — do not prefix with NEXT_PUBLIC_.'
    )
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
