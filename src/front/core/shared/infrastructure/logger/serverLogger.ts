import 'server-only'

import { createLogger } from '@/core/shared/infrastructure/logger/createLogger'

/**
 * Server-side Logger singleton.
 *
 * Lee DEBUG_ENABLED de process.env (server-only, no NEXT_PUBLIC_).
 * Se importa en Route Handlers, Server Components, use cases server-side.
 *
 * Ejemplo:
 *   import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
 *   serverLogger.info('User fetched', { id: '123' })
 */
export const serverLogger = createLogger({
  enabled: process.env.DEBUG_ENABLED,
})
