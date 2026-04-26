export interface SmsPort {
  sendOtp(phoneNumber: string, code: string): Promise<void>
}
