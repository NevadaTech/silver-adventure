import type { Logger } from '@/core/shared/domain/Logger'

import { ConsoleLogger } from '@/core/shared/infrastructure/logger/ConsoleLogger'
import { NullLogger } from '@/core/shared/infrastructure/logger/NullLogger'

interface CreateLoggerOptions {
  /**
   * Habilita o deshabilita el logger.
   * Acepta boolean o string ("true"/"false") para compatibilidad con env vars.
   * Cualquier valor que no sea `true` o `"true"` se trata como deshabilitado.
   */
  enabled?: boolean | string
}

/**
 * Factory que crea la instancia correcta de Logger.
 *
 * Uso en server (Route Handlers, Server Components):
 *   createLogger({ enabled: process.env.DEBUG_ENABLED })
 *
 * Uso en client (Client Components):
 *   createLogger({ enabled: process.env.NEXT_PUBLIC_DEBUG_ENABLED })
 *
 * Si `enabled` es falsy, undefined, o cualquier cosa que no sea true/"true",
 * retorna un NullLogger (Null Object pattern — cero output).
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const isEnabled = options.enabled === true || options.enabled === 'true'

  return isEnabled ? new ConsoleLogger() : new NullLogger()
}
