'use client'

import { createLogger } from '@/core/shared/infrastructure/logger/createLogger'

/**
 * Client-side Logger singleton.
 *
 * Lee NEXT_PUBLIC_DEBUG_ENABLED — el UNICO NEXT_PUBLIC_ del proyecto.
 * NO es un secreto ni dato de DB — es un flag booleano de debug.
 * Esto NO viola el patrón BFF.
 *
 * Se importa en Client Components y hooks.
 *
 * Ejemplo:
 *   import { clientLogger } from '@/core/shared/infrastructure/logger/clientLogger'
 *   clientLogger.info('SWR fetched users', { count: 5 })
 */
export const clientLogger = createLogger({
  enabled: process.env.NEXT_PUBLIC_DEBUG_ENABLED,
})
