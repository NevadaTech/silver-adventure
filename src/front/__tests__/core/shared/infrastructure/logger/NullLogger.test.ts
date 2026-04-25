import { describe, it, expect, vi, beforeEach } from 'vitest'

import { NullLogger } from '@/core/shared/infrastructure/logger/NullLogger'

describe('NullLogger', () => {
  let logger: NullLogger

  beforeEach(() => {
    logger = new NullLogger()
    vi.restoreAllMocks()
  })

  it('should NOT call console.debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})

    logger.debug('should be silenced')

    expect(spy).not.toHaveBeenCalled()
  })

  it('should NOT call console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logger.info('should be silenced')

    expect(spy).not.toHaveBeenCalled()
  })

  it('should NOT call console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logger.warn('should be silenced')

    expect(spy).not.toHaveBeenCalled()
  })

  it('should NOT call console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.error('should be silenced')

    expect(spy).not.toHaveBeenCalled()
  })

  it('should accept extra arguments without throwing', () => {
    expect(() => logger.info('msg', { a: 1 }, 'extra')).not.toThrow()
  })
})
