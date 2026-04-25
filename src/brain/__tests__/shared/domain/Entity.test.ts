import { describe, it, expect } from 'vitest'
import { Entity } from '@/shared/domain/Entity'

class TestEntity extends Entity<string> {
  constructor(
    id: string,
    public readonly name: string,
  ) {
    super(id)
  }
}

describe('Entity', () => {
  it('exposes the id via getter', () => {
    const entity = new TestEntity('abc', 'foo')
    expect(entity.id).toBe('abc')
  })

  it('considers two entities equal when they share id', () => {
    const a = new TestEntity('abc', 'foo')
    const b = new TestEntity('abc', 'bar')
    expect(a.equals(b)).toBe(true)
  })

  it('considers two entities different when ids differ', () => {
    const a = new TestEntity('abc', 'foo')
    const b = new TestEntity('xyz', 'foo')
    expect(a.equals(b)).toBe(false)
  })
})
