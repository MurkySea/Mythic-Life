import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Private access gate.
 *
 * Env:
 *   ALLOWED_IPS          Comma-separated public IPs (e.g. "1.2.3.4,5.6.7.8").
 *                        If empty/unset, the gate is off (open access).
 *   ACCESS_BYPASS_SECRET Optional. Header `x-access-secret` or query `?access=`
 *                        matching this value bypasses the IP check (for when
 *                        your home IP changes).
 *
 * Cron: /api/cron/* is not IP-gated here; those routes already require
 * CRON_SECRET via Authorization Bearer.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Always allow Next internals and static assets
  if (
    path.startsWith('/_next') ||
    path.startsWith('/favicon') ||
    path === '/manifest.webmanifest' ||
    path === '/sw.js'
  ) {
    return NextResponse.next()
  }

  // Cron is authenticated by CRON_SECRET inside the route handler
  if (path.startsWith('/api/cron')) {
    return NextResponse.next()
  }

  const allowedRaw = process.env.ALLOWED_IPS || ''
  const allowed = allowedRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // Gate off until you configure ALLOWED_IPS in Vercel
  if (allowed.length === 0) {
    return NextResponse.next()
  }

  // Emergency bypass (IP changed)
  const bypass = process.env.ACCESS_BYPASS_SECRET
  if (bypass) {
    const header = request.headers.get('x-access-secret')
    const query = request.nextUrl.searchParams.get('access')
    if (header === bypass || query === bypass) {
      return NextResponse.next()
    }
  }

  const ip = clientIp(request)
  if (ip && allowed.includes(ip)) {
    return NextResponse.next()
  }

  return new NextResponse('Forbidden — this realm is sealed.', {
    status: 403,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function clientIp(request: NextRequest): string {
  // Vercel / proxies: first hop in x-forwarded-for is the client
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  // NextRequest.ip is available on some runtimes
  const anyReq = request as NextRequest & { ip?: string }
  if (anyReq.ip) return anyReq.ip
  return ''
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)'],
}
