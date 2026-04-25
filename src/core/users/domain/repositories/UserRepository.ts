import type { User } from '@/core/users/domain/entities/User'

/**
 * User Repository Port
 *
 * Contrato que define QUÉ necesita el dominio.
 * La implementación (Supabase, InMemory, etc.) vive en infrastructure/.
 */
export interface UserRepository {
  findAll(): Promise<User[]>
  findById(id: string): Promise<User | null>
}
