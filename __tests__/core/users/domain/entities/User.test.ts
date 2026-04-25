import { describe, it, expect } from 'vitest'

import { User } from '@/core/users/domain/entities/User'

describe('User Entity', () => {
  it('should create a user with valid name', () => {
    const user = User.create('1', 'Ted')

    expect(user.id).toBe('1')
    expect(user.name).toBe('Ted')
    expect(user.createdAt).toBeInstanceOf(Date)
  })

  it('should trim the name', () => {
    const user = User.create('1', '  Ted  ')

    expect(user.name).toBe('Ted')
  })

  it('should throw when name is empty', () => {
    expect(() => User.create('1', '')).toThrow('User name cannot be empty')
  })

  it('should throw when name is only whitespace', () => {
    expect(() => User.create('1', '   ')).toThrow('User name cannot be empty')
  })

  it('should accept a custom createdAt date', () => {
    const date = new Date('2026-01-01T00:00:00Z')
    const user = User.create('1', 'Ted', date)

    expect(user.createdAt).toEqual(date)
  })

  it('should be equal to another user with the same id', () => {
    const user1 = User.create('same-id', 'Ted')
    const user2 = User.create('same-id', 'Different Name')

    expect(user1.equals(user2)).toBe(true)
  })

  it('should NOT be equal to a user with a different id', () => {
    const user1 = User.create('id-1', 'Ted')
    const user2 = User.create('id-2', 'Ted')

    expect(user1.equals(user2)).toBe(false)
  })
})
