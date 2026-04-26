import type { User } from '@/core/users/domain/entities/User'

export interface BusinessProfile {
  sector: string
  yearsOfOperation: string
  municipio: string
  barrio: string
  hasChamber: boolean
  nit?: string
}

export interface AuthRepositoryResult {
  accessToken: string
  refreshToken: string
  user: User
}

export interface AuthRepository {
  registerWithOtp(
    email: string,
    password: string,
    businessName: string,
    whatsapp: string,
    businessProfile: BusinessProfile,
  ): Promise<AuthRepositoryResult>
}
