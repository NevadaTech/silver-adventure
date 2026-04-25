import { describe, it, expect } from 'vitest'

import { createLogger } from '@/core/shared/infrastructure/logger/createLogger'
import { ConsoleLogger } from '@/core/shared/infrastructure/logger/ConsoleLogger'
import { NullLogger } from '@/core/shared/infrastructure/logger/NullLogger'

describe('createLogger', () => {
  it('should return ConsoleLogger when enabled is true', () => {
    const logger = createLogger({ enabled: true })

    expect(logger).toBeInstanceOf(ConsoleLogger)
  })

  it('should return NullLogger when enabled is false', () => {
    const logger = createLogger({ enabled: false })

    expect(logger).toBeInstanceOf(NullLogger)
  })

  it('should return NullLogger when enabled is undefined', () => {
    const logger = createLogger({})

    expect(logger).toBeInstanceOf(NullLogger)
  })

  it('should accept a string "true" and return ConsoleLogger', () => {
    const logger = createLogger({ enabled: 'true' })

    expect(logger).toBeInstanceOf(ConsoleLogger)
  })

  it('should treat string "false" as disabled', () => {
    const logger = createLogger({ enabled: 'false' })

    expect(logger).toBeInstanceOf(NullLogger)
  })

  it('should treat empty string as disabled', () => {
    const logger = createLogger({ enabled: '' })

    expect(logger).toBeInstanceOf(NullLogger)
  })
})
