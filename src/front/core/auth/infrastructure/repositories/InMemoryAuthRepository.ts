import { User } from '@/core/users/domain/entities/User'
import type {
  AuthRepository,
  AuthRepositoryResult,
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

  async registerWithOtp(
    email: string,
    password: string,
    businessName: string,
    whatsapp: string,
    businessProfile: BusinessProfile,
  ): Promise<AuthRepositoryResult> {
    const existingUser = await this.findByEmail(email)
    if (existingUser) {
      throw new Error('Email already registered')
    }

    const id = `user-${this.idCounter++}`
    const user = User.create(id, businessName, new Date(), email)

    this.store.set(email, { user, password, businessProfile, whatsapp })

    return {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user,
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const entry = this.store.get(email)
    return entry?.user ?? null
  }

  async create(id: string, email: string, name: string): Promise<User> {
    const user = User.create(id, name, new Date(), email)
    this.store.set(email, { user, password: 'mock-password' })
    return user
  }

  clear(): void {
    this.store.clear()
    this.idCounter = 1
  }
}
