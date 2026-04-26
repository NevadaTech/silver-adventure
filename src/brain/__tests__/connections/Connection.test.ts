import { describe, expect, it } from 'vitest'
import {
  Connection,
  type CreateConnectionInput,
} from '@/connections/domain/entities/Connection'

const valid = (
  overrides: Partial<CreateConnectionInput> = {},
): CreateConnectionInput => ({
  id: 'conn-1',
  userId: 'user-uuid-a',
  recommendationId: 'rec-uuid-b',
  action: 'saved',
  ...overrides,
})

describe('Connection', () => {
  it('creates a connection with required fields and a default createdAt', () => {
    const before = new Date()
    const c = Connection.create(valid())
    const after = new Date()

    expect(c.id).toBe('conn-1')
    expect(c.userId).toBe('user-uuid-a')
    expect(c.recommendationId).toBe('rec-uuid-b')
    expect(c.action).toBe('saved')
    expect(c.note).toBeNull()
    expect(c.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(c.createdAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('preserves an explicit createdAt', () => {
    const fixed = new Date('2026-04-25T12:00:00Z')
    const c = Connection.create(valid({ createdAt: fixed }))
    expect(c.createdAt).toEqual(fixed)
  })

  it('trims and stores notes that fit within the 280 char limit', () => {
    const c = Connection.create(valid({ note: '  hello world  ' }))
    expect(c.note).toBe('hello world')
  })

  it('treats empty/whitespace notes as null', () => {
    expect(Connection.create(valid({ note: '   ' })).note).toBeNull()
    expect(Connection.create(valid({ note: '' })).note).toBeNull()
    expect(Connection.create(valid({ note: null })).note).toBeNull()
  })

  it('rejects a note longer than 280 characters', () => {
    const long = 'x'.repeat(281)
    expect(() => Connection.create(valid({ note: long }))).toThrow(
      /at most 280 characters/,
    )
  })

  it('rejects empty id, userId or recommendationId', () => {
    expect(() => Connection.create(valid({ id: '' }))).toThrow(
      'Connection.id cannot be empty',
    )
    expect(() => Connection.create(valid({ userId: '   ' }))).toThrow(
      'Connection.userId cannot be empty',
    )
    expect(() => Connection.create(valid({ recommendationId: '' }))).toThrow(
      'Connection.recommendationId cannot be empty',
    )
  })

  it('matchesKey returns true only when userId+recId+action match', () => {
    const c = Connection.create(valid())
    expect(c.matchesKey('user-uuid-a', 'rec-uuid-b', 'saved')).toBe(true)
    expect(c.matchesKey('user-uuid-a', 'rec-uuid-b', 'marked')).toBe(false)
    expect(c.matchesKey('other-user', 'rec-uuid-b', 'saved')).toBe(false)
  })
})
