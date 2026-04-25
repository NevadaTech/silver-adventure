import { describe, it, expect, beforeEach } from 'vitest'

import { User } from '@/core/users/domain/entities/User'
import { InMemoryUserRepository } from '@/core/users/infrastructure/repositories/InMemoryUserRepository'

describe('InMemoryUserRepository', () => {
  let repository: InMemoryUserRepository

  beforeEach(() => {
    repository = new InMemoryUserRepository()
  })

  describe('save() + findById()', () => {
    it('persists and retrieves a user by id', async () => {
      const user = User.create('1', 'Ted')
      await repository.save(user)

      const found = await repository.findById('1')

      expect(found).not.toBeNull()
      expect(found!.id).toBe('1')
      expect(found!.name).toBe('Ted')
    })
  })

  describe('findById()', () => {
    it('returns null when user does not exist', async () => {
      const found = await repository.findById('non-existent')

      expect(found).toBeNull()
    })
  })

  describe('findAll()', () => {
    it('returns empty array when store is empty', async () => {
      const users = await repository.findAll()

      expect(users).toEqual([])
    })

    it('returns all saved users', async () => {
      await repository.save(User.create('1', 'Ted'))
      await repository.save(User.create('2', 'Ana'))

      const users = await repository.findAll()

      expect(users).toHaveLength(2)
    })
  })

  describe('clear()', () => {
    it('removes all users from the store', async () => {
      await repository.save(User.create('1', 'Ted'))
      await repository.save(User.create('2', 'Ana'))

      repository.clear()

      const users = await repository.findAll()
      expect(users).toEqual([])
    })
  })
})
