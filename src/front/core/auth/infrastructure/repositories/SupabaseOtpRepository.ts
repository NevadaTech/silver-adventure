import { createSupabaseServerClient } from '@/core/shared/infrastructure/supabase/server'
import type {
  OtpRepository,
  OtpSession,
} from '@/core/auth/domain/repositories/OtpRepository'

export class SupabaseOtpRepository implements OtpRepository {
  private readonly client = createSupabaseServerClient()

  async createSession(
    phoneNumber: string,
    code: string,
    registrationData: Record<string, unknown>,
  ): Promise<OtpSession> {
    const sessionId = crypto.getRandomValues(new Uint8Array(16))
    const sessionIdHex = Array.from(sessionId)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    const { data, error } = await (this.client.from('otp_sessions') as any)
      .insert([
        {
          session_id: sessionIdHex,
          phone_number: phoneNumber,
          code,
          registration_data: registrationData,
          expires_at: expiresAt.toISOString(),
        },
      ])
      .select()
      .single()

    if (error || !data) {
      throw new Error(`Failed to create OTP session: ${error?.message}`)
    }

    return {
      sessionId: data.session_id,
      phoneNumber: data.phone_number,
      code: data.code,
      expiresAt: new Date(data.expires_at),
      registrationData: data.registration_data,
    }
  }

  async findSession(sessionId: string): Promise<OtpSession | null> {
    const { data, error } = await (this.client.from('otp_sessions') as any)
      .select()
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to find session: ${error.message}`)
    }

    return {
      sessionId: data.session_id,
      phoneNumber: data.phone_number,
      code: data.code,
      expiresAt: new Date(data.expires_at),
      registrationData: data.registration_data,
    }
  }

  async verifyCode(sessionId: string, code: string): Promise<boolean> {
    const session = await this.findSession(sessionId)
    if (!session) return false
    return session.code === code
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('otp_sessions')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`)
    }
  }
}
