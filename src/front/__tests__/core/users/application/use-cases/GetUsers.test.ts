import { describe, it, expect, beforeEach } from 'vitest'

import { User } from '@/core/users/domain/entities/User'
import { GetUsers } from '@/core/users/application/use-cases/GetUsers'
import { InMemoryUserRepository } from '@/core/users/infrastructure/repositories/InMemoryUserRepository'

describe('GetUsers', () => {
  let repository: InMemoryUserRepository
  let getUsers: GetUsers

  beforeEach(() => {
    repository = new InMemoryUserRepository()
    getUsers = new GetUsers(repository)
  })

  it('should return an empty list when there are no users', async () => {
    const { users } = await getUsers.execute()

    expect(users).toEqual([])
  })

  it('should return all existing users', async () => {
    const ted = User.create('1', 'Ted')
    const ana = User.create('2', 'Ana')
    await repository.save(ted)
    await repository.save(ana)

    const { users } = await getUsers.execute()

    expect(users).toHaveLength(2)
    expect(users.map((u) => u.name)).toEqual(['Ted', 'Ana'])
  })

  it('should return users with correct properties', async () => {
    const now = new Date('2026-04-24T12:00:00Z')
    const ted = User.create('uuid-1', 'Ted', now)
    await repository.save(ted)

    const { users } = await getUsers.execute()

    expect(users[0].id).toBe('uuid-1')
    expect(users[0].name).toBe('Ted')
    expect(users[0].createdAt).toEqual(now)
  })
})
