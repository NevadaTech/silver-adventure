/**
 * Logger Port
 *
 * Contrato que define las operaciones de logging disponibles.
 * Vive en domain — CERO dependencias de infraestructura.
 *
 * Los adapters (ConsoleLogger, NullLogger) implementan este contrato.
 * La factory (createLogger) decide cuál usar en base a la configuración.
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}
