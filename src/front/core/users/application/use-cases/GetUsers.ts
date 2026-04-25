import type { UseCase } from '@/core/shared/domain/UseCase'
import type { User } from '@/core/users/domain/entities/User'
import type { UserRepository } from '@/core/users/domain/repositories/UserRepository'

type GetUsersInput = void

interface GetUsersOutput {
  users: User[]
}

/**
 * GetUsers Use Case
 *
 * Trae todos los usuarios. Orquesta, no implementa.
 * El repository inyectado decide de DÓNDE vienen los datos.
 */
export class GetUsers implements UseCase<GetUsersInput, GetUsersOutput> {
  constructor(private readonly repository: UserRepository) {}

  async execute(): Promise<GetUsersOutput> {
    const users = await this.repository.findAll()
    return { users }
  }
}
