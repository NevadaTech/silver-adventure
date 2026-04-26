import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/core/shared/infrastructure/supabase/database.types'
import { User } from '@/core/users/domain/entities/User'
import type {
  AuthRepository,
  AuthRepositoryResult,
  BusinessProfile,
} from '@/core/auth/domain/repositories/AuthRepository'

export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async registerWithOtp(
    email: string,
    password: string,
    businessName: string,
    whatsapp: string,
    businessProfile: BusinessProfile,
  ): Promise<AuthRepositoryResult> {
    const { data: authData, error: authError } = await this.client.auth.signUp({
      email,
      password,
    })

    if (authError || !authData.user || !authData.session) {
      throw new Error(`Failed to register user: ${authError?.message}`)
    }

    type UserRowInsert = {
      id: string
      email: string
      name: string
      whatsapp: string
      sector: string
      years_of_operation?: string
      municipio: string
      barrio: string
      has_chamber: boolean
      nit: string | null
      created_at: string
    }
    type UserRowSelected = Pick<
      UserRowInsert,
      'id' | 'name' | 'email' | 'created_at'
    >

    const insertRow: UserRowInsert = {
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
    }

    const { data, error } = await this.client
      .from('users')
      .insert([
        insertRow as unknown as Database['public']['Tables']['users']['Insert'],
      ])
      .select('id, name, email, created_at')
      .single()

    if (error || !data) {
      throw new Error(`Failed to create user profile: ${error?.message}`)
    }

    const typedData = data as unknown as UserRowSelected
    const user = User.create(
      typedData.id,
      typedData.name,
      new Date(typedData.created_at),
      typedData.email,
    )

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user,
    }
  }
}
