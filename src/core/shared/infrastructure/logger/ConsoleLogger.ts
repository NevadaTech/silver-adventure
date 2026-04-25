import type { Logger } from '@/core/shared/domain/Logger'

/**
 * ConsoleLogger — Adapter que delega a console.*
 *
 * Cada método agrega un prefijo con el nivel para facilitar
 * el filtrado en la consola del browser o del terminal.
 *
 * Se usa en desarrollo cuando DEBUG_ENABLED=true.
 */
export class ConsoleLogger implements Logger {
  debug(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.debug('[DEBUG]', message, ...args)
  }

  info(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.info('[INFO]', message, ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.warn('[WARN]', message, ...args)
  }

  error(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', message, ...args)
  }
}
