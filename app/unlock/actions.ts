'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  GATE_COOKIE,
  GATE_MAX_AGE,
  checkPassword,
  expectedGateToken,
  passwordConfigured,
} from '@/lib/gate'

export async function unlockAction(formData: FormData) {
  const password = String(formData.get('password') || '')
  const nextRaw = String(formData.get('next') || '/')
  const next = nextRaw.startsWith('/') ? nextRaw : '/'

  if (!passwordConfigured() || !checkPassword(password)) {
    redirect(`/unlock?error=1&next=${encodeURIComponent(next)}`)
  }

  const jar = await cookies()
  jar.set(GATE_COOKIE, expectedGateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_MAX_AGE,
  })

  redirect(next)
}

export async function logoutAction() {
  const jar = await cookies()
  jar.set(GATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  redirect('/unlock?logged_out=1')
}
