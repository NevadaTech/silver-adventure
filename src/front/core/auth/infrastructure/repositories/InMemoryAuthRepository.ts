import { User } from '@/core/users/domain/entities/User'
import type {
  AuthRepository,
  BusinessProfile,
} from '@/core/auth/domain/repositories/AuthRepository'

interface StoredUser {
  user: User
  password: string
  businessProfile?: BusinessProfile
  whatsapp?: string
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly store = new Map<string, StoredUser>()
  private idCounter = 1

  async register(email: string, password: string, name: string): Promise<User> {
    const existingUser = await this.findByEmail(email)
    if (existingUser) {
      throw new Error('Email already registered')
    }

    const id = `user-${this.idCounter++}`
    const user = User.create(id, name, email)

    this.store.set(email, { user, password })

    return user
  }

  async registerWithOtp(
    email: string,
    password: string,
    businessName: string,
    whatsapp: string,
    businessProfile: BusinessProfile,
  ): Promise<User> {
    const existingUser = await this.findByEmail(email)
    if (existingUser) {
      throw new Error('Email already registered')
    }

    const id = `user-${this.idCounter++}`
    const user = User.create(id, businessName, email)

    this.store.set(email, { user, password, businessProfile, whatsapp })

    return user
  }

  async findByEmail(email: string): Promise<User | null> {
    const entry = this.store.get(email)
    return entry?.user ?? null
  }

  async create(id: string, email: string, name: string): Promise<User> {
    const user = User.create(id, name, email)
    this.store.set(email, { user, password: 'mock-password' })
    return user
  }

  clear(): void {
    this.store.clear()
    this.idCounter = 1
  }
}
