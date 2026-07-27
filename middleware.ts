import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { GATE_COOKIE, isValidGateToken, passwordConfigured } from '@/lib/gate'

/**
 * Access gate
 *
 * Primary: SITE_PASSWORD → cookie (see /unlock)
 * Optional extra: ALLOWED_IPS (AND with cookie if set)
 * Cron: /api/cron/* uses CRON_SECRET in the route, not this gate
 *
 * If SITE_PASSWORD is unset, the gate is open (local/dev).
 */
export function middleware(request: NextRequest) {
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

  // Unlock page + action always reachable
  if (path === '/unlock' || path.startsWith('/unlock/')) {
    return NextResponse.next()
  }

  if (!passwordConfigured()) {
    return NextResponse.next()
  }

  const token = request.cookies.get(GATE_COOKIE)?.value
  if (!isValidGateToken(token)) {
    const url = request.nextUrl.clone()
    url.pathname = '/unlock'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // Optional second lock: IP allowlist
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

  return NextResponse.next()
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
  if (anyReq.ip) return anyReq.ip
  return ''
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}
