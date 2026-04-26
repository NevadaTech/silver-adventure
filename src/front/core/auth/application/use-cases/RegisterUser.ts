import type { UseCase } from '@/core/shared/domain/UseCase'
import type { User } from '@/core/users/domain/entities/User'
import type { AuthRepository } from '@/core/auth/domain/repositories/AuthRepository'

export interface RegisterUserInput {
  email: string
  password: string
  name: string
}

export interface RegisterUserOutput {
  user: User
}

export class RegisterUser implements UseCase<
  RegisterUserInput,
  RegisterUserOutput
> {
  constructor(private readonly repository: AuthRepository) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    if (!input.email || input.email.trim().length === 0) {
      throw new Error('Email cannot be empty')
    }

    if (!input.password || input.password.length === 0) {
      throw new Error('Password cannot be empty')
    }

    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Name cannot be empty')
    }

    const existingUser = await this.repository.findByEmail(input.email)
    if (existingUser) {
      throw new Error('Email already registered')
    }

    const user = await this.repository.register(
      input.email,
      input.password,
      input.name,
    )

    return { user }
  }
}
