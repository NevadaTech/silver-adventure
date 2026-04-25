/**
 * Logger — Public API
 *
 * Re-exporta todo lo necesario para usar el logger.
 * NO re-exporta serverLogger ni clientLogger — esos se importan
 * directamente para que el tree-shaking funcione (server-only / use client).
 */
export { createLogger } from '@/core/shared/infrastructure/logger/createLogger'
export { ConsoleLogger } from '@/core/shared/infrastructure/logger/ConsoleLogger'
export { NullLogger } from '@/core/shared/infrastructure/logger/NullLogger'
export type { Logger } from '@/core/shared/domain/Logger'
