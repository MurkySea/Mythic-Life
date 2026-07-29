import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { GATE_COOKIE, isValidGateToken, passwordConfigured } from '@/lib/gate'

/**
 * Two-layer access control:
 * 1. Optional SITE_PASSWORD gate.
 * 2. Supabase owner authentication for every private app route.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (
    path.startsWith('/_next') ||
    path.startsWith('/favicon') ||
    path === '/manifest.webmanifest' ||
    path === '/sw.js' ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/.test(path)
  ) {
    return NextResponse.next()
  }

  if (path.startsWith('/api/cron')) {
    return NextResponse.next()
  }

  // The password gate must remain reachable without either credential.
  if (path === '/unlock' || path.startsWith('/unlock/')) {
    return NextResponse.next()
  }

  if (passwordConfigured()) {
    const token = request.cookies.get(GATE_COOKIE)?.value
    if (!isValidGateToken(token)) {
      const url = request.nextUrl.clone()
      url.pathname = '/unlock'
      url.searchParams.set('next', `${path}${request.nextUrl.search}`)
      return NextResponse.redirect(url)
    }

    const allowedRaw = process.env.ALLOWED_IPS || ''
    const allowed = allowedRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (allowed.length > 0) {
      const ip = clientIp(request)
      if (!ip || !allowed.includes(ip)) {
        return new NextResponse('Forbidden — IP not on the list.', {
          status: 403,
          headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
        })
      }
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return new NextResponse('Supabase environment variables are missing.', { status: 500 })
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser validates and refreshes the session instead of trusting stale cookie data.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && path !== '/login' && !path.startsWith('/login/')) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', `${path}${request.nextUrl.search}`)

    const redirectResponse = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  if (user && (path === '/login' || path.startsWith('/login/'))) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''

    const redirectResponse = NextResponse.redirect(homeUrl)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  return response
}

function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  const anyReq = request as NextRequest & { ip?: string }
  return anyReq.ip || ''
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}
