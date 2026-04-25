import { describe, it, expect } from 'vitest'

import { Entity } from '@/core/shared/domain/Entity'

/**
 * Concrete implementation for testing the abstract base class.
 */
class TestEntity extends Entity<string> {
  constructor(id: string) {
    super(id)
  }
}

describe('Entity', () => {
  describe('id', () => {
    it('exposes the identity via getter', () => {
      const entity = new TestEntity('abc-123')

      expect(entity.id).toBe('abc-123')
    })
  })

  describe('equals()', () => {
    it('entities with same id are equal', () => {
      const a = new TestEntity('1')
      const b = new TestEntity('1')

      expect(a.equals(b)).toBe(true)
    })

    it('entities with different id are NOT equal', () => {
      const a = new TestEntity('1')
      const b = new TestEntity('2')

      expect(a.equals(b)).toBe(false)
    })

    it('returns false when comparing with a non-Entity (instanceof branch)', () => {
      const entity = new TestEntity('1')
      // Force a non-Entity through the type system to hit the instanceof guard
      const fake = { _id: '1' } as unknown as TestEntity

      expect(entity.equals(fake)).toBe(false)
    })
  })
})
