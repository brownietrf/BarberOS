import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Rate limiting for public book pages ────────────────────────────────────
  if (pathname.startsWith('/book/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    const result = rateLimit(ip, 20, 60_000) // 20 req / min per IP

    if (!result.success) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Content-Type':        'text/plain',
          'Retry-After':         String(retryAfter),
          'X-RateLimit-Limit':   '20',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':   String(result.resetAt),
        },
      })
    }
  }

  // ── Auth guard for protected routes ────────────────────────────────────────
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/reset-password'
  ) {
    // Inject current pathname so Server Component layouts can read it
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', pathname)
    let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            // Keep x-pathname when rebuilding the response for cookie refresh
            cookiesToSet.forEach(({ name, value }) => requestHeaders.set(`cookie-${name}`, value))
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user && (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/admin')
    )) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/book/:path*',
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/admin/:path*',
    '/login',
    '/reset-password',
  ],
}
