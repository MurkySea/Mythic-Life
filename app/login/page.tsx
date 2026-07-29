import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { signIn } from './actions'
import styles from './login.module.css'

export const dynamic = 'force-dynamic'

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (data.user) redirect(params.next || '/')

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <section className={styles.card}>
        <p className={styles.eyebrow}>MYTHIC LIFE</p>
        <h1>Return to your world</h1>
        <p className={styles.copy}>
          Sign in with the owner account connected to this realm.
        </p>

        {params.error ? <p className={styles.error}>{params.error}</p> : null}

        <form action={signIn} className={styles.form}>
          <input type="hidden" name="next" value={params.next || '/'} />

          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required autoFocus />
          </label>

          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <button type="submit">Enter Mythic Life</button>
        </form>
      </section>
    </main>
  )
}
