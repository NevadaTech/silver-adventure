export interface OtpSession {
  sessionId: string
  phoneNumber: string
  code: string
  expiresAt: Date
  registrationData: Record<string, unknown>
}

export interface OtpRepository {
  createSession(
    phoneNumber: string,
    code: string,
    registrationData: Record<string, unknown>,
  ): Promise<OtpSession>
  findSession(sessionId: string): Promise<OtpSession | null>
  verifyCode(sessionId: string, code: string): Promise<boolean>
  deleteSession(sessionId: string): Promise<void>
}
