import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/core/shared/infrastructure/supabase/database.types'
import { User } from '@/core/users/domain/entities/User'
import type { UserRepository } from '@/core/users/domain/repositories/UserRepository'

/**
 * Supabase User Repository — Infrastructure Adapter
 *
 * Esta es la implementación REAL del puerto UserRepository.
 * Habla con Supabase. El dominio no sabe que esto existe.
 *
 * Fijate: recibe el client por constructor (inyección de dependencias).
 * No importa createSupabaseServerClient acá — eso es responsabilidad
 * de quien compone (el Server Component o la factory).
 */
export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findAll(): Promise<User[]> {
    const { data, error } = await this.client
      .from('users')
      .select('id, name, email, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }

    return data.map((row) =>
      User.create(row.id, row.name, row.email, new Date(row.created_at)),
    )
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('id, name, email, created_at')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to fetch user: ${error.message}`)
    }

    return User.create(
      data.id,
      data.name,
      data.email,
      new Date(data.created_at),
    )
  }
}
