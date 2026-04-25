import type { Logger } from '@/core/shared/domain/Logger'

/**
 * NullLogger — Adapter que silencia TODO.
 *
 * Implementa el patrón Null Object — misma interfaz, cero side-effects.
 * Se usa en producción o cuando DEBUG_ENABLED=false.
 *
 * Ventaja: el código que consume el Logger no necesita condicionales.
 * Simplemente llamás logger.info() y si está deshabilitado, no pasa nada.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export class NullLogger implements Logger {
  debug(message: string, ...args: unknown[]): void {
    // Intentionally empty — Null Object pattern
  }

  info(message: string, ...args: unknown[]): void {
    // Intentionally empty — Null Object pattern
  }

  warn(message: string, ...args: unknown[]): void {
    // Intentionally empty — Null Object pattern
  }

  error(message: string, ...args: unknown[]): void {
    // Intentionally empty — Null Object pattern
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
