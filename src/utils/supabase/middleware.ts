import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  let user = null
  
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.warn('Middleware auth fetch failed (network timeout/IPv6 issue):', err)
    // If the network call to validate auth fails, treat as unauthenticated
    user = null
  }

  // -- Auth guard: unauthenticated users can only visit public pages --
  const isPublicPath = pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/auth')
  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Only run database queries if authenticated and not on a public path (or if we need to check onboarding)
  if (user && !isPublicPath) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        
      if (error) {
        console.warn('Middleware profile fetch error:', error)
      }

      // -- Onboarding guard: authenticated users without a role must go to /onboarding --
      const isTryingToAccessApp = !pathname.startsWith('/onboarding')
      if (isTryingToAccessApp && !profile?.role) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }

      // -- Already onboarded users should not revisit onboarding --
      const isVisitingOnboarding = pathname.startsWith('/onboarding')
      if (isVisitingOnboarding && profile?.role) {
        return NextResponse.redirect(new URL('/chat', request.url))
      }
    } catch (err) {
      console.warn('Middleware DB fetch failed:', err)
      // On DB timeout, fallback to letting them proceed instead of breaking the app
    }
  }

  return response
}
