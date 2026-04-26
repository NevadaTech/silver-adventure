import type { User } from '@/core/users/domain/entities/User'

export interface BusinessProfile {
  sector: string
  yearsOfOperation: string
  municipio: string
  barrio: string
  hasChamber: boolean
  nit?: string
}

export interface AuthRepository {
  register(email: string, password: string, name: string): Promise<User>
  findByEmail(email: string): Promise<User | null>
  registerWithOtp(
    email: string,
    password: string,
    businessName: string,
    whatsapp: string,
    businessProfile: BusinessProfile,
  ): Promise<User>
}
