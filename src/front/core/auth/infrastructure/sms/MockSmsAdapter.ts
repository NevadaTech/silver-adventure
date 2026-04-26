import type { SmsPort } from '@/core/auth/domain/ports/SmsPort'

export class MockSmsAdapter implements SmsPort {
  private lastSentPhone: string = ''
  private lastSentCode: string = ''

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    this.lastSentPhone = phoneNumber
    this.lastSentCode = code
    console.log(
      `[MOCK SMS] OTP sent to ${phoneNumber}: ${code} (for development only)`,
    )
  }

  getLastSentCode(): string {
    return this.lastSentCode
  }

  getLastSentPhone(): string {
    return this.lastSentPhone
  }
}
