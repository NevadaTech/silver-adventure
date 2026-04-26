import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'

import { env } from '@/core/shared/infrastructure/env'

import { routing } from './i18n/routing'

const handleI18n = createIntlMiddleware(routing)

const PROTECTED_PREFIX = '/app'

/**
 * Proxy (Next.js 16) — composición de:
 *   1) `next-intl` para resolución de locale.
 *   2) Guard de sesión Supabase para `/app/*`.
 *
 * Usamos `@supabase/ssr` para leer/refrescar la sesión vía cookies. Si el
 * usuario navega a una ruta protegida sin sesión, redirigimos a /login. La
 * respuesta de Supabase puede traer cookies actualizadas (refresh token); las
 * fusionamos con la respuesta de next-intl para no perderlas.
 */
export default async function proxy(request: NextRequest) {
  const intlResponse = handleI18n(request)

  const isProtected = request.nextUrl.pathname.startsWith(PROTECTED_PREFIX)
  if (!isProtected) return intlResponse

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            intlResponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return intlResponse
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
