import type {
  OtpRepository,
  OtpSession,
} from '@/core/auth/domain/repositories/OtpRepository'

function generateSessionId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}

export class InMemoryOtpRepository implements OtpRepository {
  private readonly sessions = new Map<string, OtpSession>()

  async createSession(
    phoneNumber: string,
    code: string,
    registrationData: Record<string, unknown>,
  ): Promise<OtpSession> {
    const sessionId = generateSessionId()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const session: OtpSession = {
      sessionId,
      phoneNumber,
      code,
      expiresAt,
      registrationData,
    }

    this.sessions.set(sessionId, session)
    return session
  }

  async findSession(sessionId: string): Promise<OtpSession | null> {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId)
      return null
    }

    return session
  }

  async verifyCode(sessionId: string, code: string): Promise<boolean> {
    const session = await this.findSession(sessionId)
    if (!session) return false
    return session.code === code
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  clear(): void {
    this.sessions.clear()
  }
}
