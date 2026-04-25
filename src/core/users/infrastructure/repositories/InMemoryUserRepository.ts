import { User } from '@/core/users/domain/entities/User'
import type { UserRepository } from '@/core/users/domain/repositories/UserRepository'

/**
 * InMemory User Repository — Adapter para Tests
 *
 * Nunca toca una DB real. Rápida, determinista, controlable.
 * Cuando escribas tests de use cases, inyectá ESTO.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>()

  async findAll(): Promise<User[]> {
    return Array.from(this.store.values())
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null
  }

  // Helpers para tests
  async save(user: User): Promise<void> {
    this.store.set(user.id, user)
  }

  clear(): void {
    this.store.clear()
  }
}
