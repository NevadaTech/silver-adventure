import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/core/shared/infrastructure/supabase/database.types'
import { User } from '@/core/users/domain/entities/User'
import type {
  AuthRepository,
  BusinessProfile,
} from '@/core/auth/domain/repositories/AuthRepository'

export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async register(email: string, password: string, name: string): Promise<User> {
    const { data: authData, error: authError } = await this.client.auth.signUp({
      email,
      password,
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to register user: ${authError?.message}`)
    }

    const { data, error } = await this.client
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          name,
          created_at: new Date().toISOString(),
        },
      ])
      .select('id, name, email, created_at')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create user profile: ${error?.message}`)
    }

    return User.create(
      data.id,
      data.name,
      data.email,
      new Date(data.created_at),
    )
  }

  async registerWithOtp(
    email: string,
    password: string,
    businessName: string,
    whatsapp: string,
    businessProfile: BusinessProfile,
  ): Promise<User> {
    const { data: authData, error: authError } = await this.client.auth.signUp({
      email,
      password,
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to register user: ${authError?.message}`)
    }

    const { data, error } = await this.client
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email,
          name: businessName,
          whatsapp,
          sector: businessProfile.sector,
          years_of_operation: businessProfile.yearsOfOperation,
          municipio: businessProfile.municipio,
          barrio: businessProfile.barrio,
          has_chamber: businessProfile.hasChamber,
          nit: businessProfile.nit || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select('id, name, email, created_at')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create user profile: ${error?.message}`)
    }

    return User.create(
      data.id,
      data.name,
      data.email,
      new Date(data.created_at),
    )
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('id, name, email, created_at')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to find user: ${error.message}`)
    }

    return User.create(
      data.id,
      data.name,
      data.email,
      new Date(data.created_at),
    )
  }
}
