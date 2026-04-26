import type { UseCase } from '@/core/shared/domain/UseCase'
import type { SmsPort } from '@/core/auth/domain/ports/SmsPort'
import type { OtpRepository } from '@/core/auth/domain/repositories/OtpRepository'

export interface RegisterUserWithOtpInput {
  businessName: string
  sector: string
  yearsOfOperation: string
  municipio: string
  barrio: string
  hasChamber: boolean
  nit?: string
  whatsapp: string
  email?: string
}

export interface RegisterUserWithOtpOutput {
  sessionId: string
  message: string
}

export class RegisterUserWithOtp implements UseCase<
  RegisterUserWithOtpInput,
  RegisterUserWithOtpOutput
> {
  constructor(
    private readonly smsPort: SmsPort,
    private readonly otpRepository: OtpRepository,
  ) {}

  async execute(
    input: RegisterUserWithOtpInput,
  ): Promise<RegisterUserWithOtpOutput> {
    this.validateInput(input)

    const code = this.generateOtpCode()

    const session = await this.otpRepository.createSession(
      input.whatsapp,
      code,
      input,
    )

    await this.smsPort.sendOtp(input.whatsapp, code)

    return {
      sessionId: session.sessionId,
      message: 'OTP sent to WhatsApp number',
    }
  }

  private validateInput(input: RegisterUserWithOtpInput): void {
    if (!input.businessName?.trim()) {
      throw new Error('Business name is required')
    }

    if (!input.sector?.trim()) {
      throw new Error('Sector is required')
    }

    if (!input.yearsOfOperation?.trim()) {
      throw new Error('Years of operation is required')
    }

    if (!input.municipio?.trim()) {
      throw new Error('Municipio is required')
    }

    if (!input.barrio?.trim()) {
      throw new Error('Barrio is required')
    }

    if (input.hasChamber && !input.nit?.trim()) {
      throw new Error('NIT is required when you have Cámara de Comercio')
    }

    if (!this.isValidWhatsappFormat(input.whatsapp)) {
      throw new Error('Invalid WhatsApp format')
    }
  }

  private isValidWhatsappFormat(whatsapp: string): boolean {
    const cleaned = whatsapp.replace(/\s/g, '')
    // Accept: +573001234567, +57 300 1234567, 573001234567, 3001234567
    return /^(\+?57)?3\d{9}$/.test(cleaned)
  }

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }
}
