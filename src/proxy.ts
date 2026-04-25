import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // Match all pathnames except:
  // - API routes (/api)
  // - Next.js internals (/_next, /_vercel)
  // - Static files (files with extensions like .ico, .png, etc.)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
