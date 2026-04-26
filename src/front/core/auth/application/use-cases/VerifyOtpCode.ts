import type { UseCase } from '@/core/shared/domain/UseCase'
import type { User } from '@/core/users/domain/entities/User'
import type { AuthRepository } from '@/core/auth/domain/repositories/AuthRepository'
import type { OtpRepository } from '@/core/auth/domain/repositories/OtpRepository'

export interface VerifyOtpCodeInput {
  sessionId: string
  code: string
}

export interface VerifyOtpCodeOutput {
  user: User
}

export class VerifyOtpCode implements UseCase<
  VerifyOtpCodeInput,
  VerifyOtpCodeOutput
> {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly otpRepository: OtpRepository,
  ) {}

  async execute(input: VerifyOtpCodeInput): Promise<VerifyOtpCodeOutput> {
    const session = await this.otpRepository.findSession(input.sessionId)

    if (!session) {
      throw new Error('Invalid or expired OTP session')
    }

    const isValidCode = await this.otpRepository.verifyCode(
      input.sessionId,
      input.code,
    )

    if (!isValidCode) {
      throw new Error('Invalid or expired OTP code')
    }

    const registrationData = session.registrationData as {
      businessName: string
      sector: string
      yearsOfOperation: string
      municipio: string
      barrio: string
      hasChamber: boolean
      nit?: string
      whatsapp: string
      email?: string
      password: string
    }

    const user = await this.authRepository.registerWithOtp(
      registrationData.email || registrationData.whatsapp + '@negocio.local',
      registrationData.password,
      registrationData.businessName,
      registrationData.whatsapp,
      {
        sector: registrationData.sector,
        yearsOfOperation: registrationData.yearsOfOperation,
        municipio: registrationData.municipio,
        barrio: registrationData.barrio,
        hasChamber: registrationData.hasChamber,
        nit: registrationData.nit,
      },
    )

    await this.otpRepository.deleteSession(input.sessionId)

    return { user }
  }
}
