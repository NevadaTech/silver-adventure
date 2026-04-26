import { describe, expect, it } from 'vitest'
import { serializeError } from '@/shared/infrastructure/errors/serializeError'

describe('serializeError', () => {
  it('returns the message of an Error instance', () => {
    expect(serializeError(new Error('boom'))).toBe('boom')
  })

  it('preserves the original Error subclass message', () => {
    class MyError extends Error {}
    expect(serializeError(new MyError('typed boom'))).toBe('typed boom')
  })

  it('serializes a Postgres-style POJO with code, message, details and hint', () => {
    const pgError = {
      code: '22P02',
      details: null,
      hint: null,
      message: 'invalid input syntax for type uuid: ""',
    }
    const result = serializeError(pgError)
    expect(result).toContain('22P02')
    expect(result).toContain('invalid input syntax for type uuid: ""')
  })

  it('includes details and hint when present in a Postgres-style POJO', () => {
    const pgError = {
      code: '23505',
      message: 'duplicate key',
      details: 'Key (id)=(abc) already exists.',
      hint: 'consider upsert',
    }
    const result = serializeError(pgError)
    expect(result).toContain('23505')
    expect(result).toContain('duplicate key')
    expect(result).toContain('Key (id)=(abc) already exists.')
    expect(result).toContain('consider upsert')
  })

  it('handles a POJO that only has a message field', () => {
    expect(serializeError({ message: 'plain message' })).toBe('plain message')
  })

  it('falls back to JSON for an arbitrary object without a message', () => {
    expect(serializeError({ foo: 'bar' })).toBe('{"foo":"bar"}')
  })

  it('returns the string itself when given a string', () => {
    expect(serializeError('raw string')).toBe('raw string')
  })

  it('handles null and undefined', () => {
    expect(serializeError(null)).toBe('null')
    expect(serializeError(undefined)).toBe('undefined')
  })

  it('handles a number or boolean', () => {
    expect(serializeError(42)).toBe('42')
    expect(serializeError(false)).toBe('false')
  })

  it('does not throw on circular objects', () => {
    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular
    expect(() => serializeError(circular)).not.toThrow()
  })
})
