import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { VerifyOtpCode } from '@/core/auth/application/use-cases/VerifyOtpCode'
import { authStore } from '@/core/auth/infrastructure/repositories/sharedAuthStore'
import { otpStore } from '@/core/auth/infrastructure/repositories/sharedOtpStore'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { sessionId, code } = body

    if (!sessionId || !code) {
      return Response.json(
        { error: 'sessionId and code are required' },
        { status: 400 },
      )
    }

    const otpRepository = otpStore
    const verifyOtpCode = new VerifyOtpCode(authStore, otpRepository)

    const { user } = await verifyOtpCode.execute({
      sessionId,
      code,
    })

    return Response.json(
      {
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt.toISOString(),
          },
        },
      },
      { status: 201 },
    )
  } catch (error) {
    serverLogger.error('[POST /api/auth/verify-otp]', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    return Response.json({ error: message }, { status: 400 })
  }
}
