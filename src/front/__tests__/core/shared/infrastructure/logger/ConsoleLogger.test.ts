import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ConsoleLogger } from '@/core/shared/infrastructure/logger/ConsoleLogger'

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger

  beforeEach(() => {
    logger = new ConsoleLogger()
    vi.restoreAllMocks()
  })

  it('should delegate debug() to console.debug with prefix', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    logger.debug('test message')

    expect(spy).toHaveBeenCalledWith('[DEBUG]', 'test message')
  })

  it('should delegate info() to console.info with prefix', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logger.info('test message')

    expect(spy).toHaveBeenCalledWith('[INFO]', 'test message')
  })

  it('should delegate warn() to console.warn with prefix', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logger.warn('test message')

    expect(spy).toHaveBeenCalledWith('[WARN]', 'test message')
  })

  it('should delegate error() to console.error with prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.error('test message')

    expect(spy).toHaveBeenCalledWith('[ERROR]', 'test message')
  })

  it('should pass extra arguments through to console methods', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const extra = { userId: 123 }

    logger.info('user created', extra)

    expect(spy).toHaveBeenCalledWith('[INFO]', 'user created', extra)
  })

  it('should pass multiple extra arguments', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    logger.debug('multi', 'a', 'b', 3)

    expect(spy).toHaveBeenCalledWith('[DEBUG]', 'multi', 'a', 'b', 3)
  })
})
