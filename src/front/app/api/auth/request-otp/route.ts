import { serverLogger } from '@/core/shared/infrastructure/logger/serverLogger'
import { RegisterUserWithOtp } from '@/core/auth/application/use-cases/RegisterUserWithOtp'
import { MockSmsAdapter } from '@/core/auth/infrastructure/sms/MockSmsAdapter'
import { otpStore } from '@/core/auth/infrastructure/repositories/sharedOtpStore'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    serverLogger.info('Request body:', body)

    const {
      businessName,
      sector,
      yearsOfOperation,
      municipio,
      barrio,
      hasChamber,
      nit,
      whatsapp,
      email,
    } = body

    serverLogger.info('Extracted fields:', {
      businessName,
      sector,
      whatsapp,
    })

    if (!businessName || !sector || !whatsapp) {
      return Response.json(
        {
          error: 'businessName, sector, and whatsapp are required',
          received: { businessName, sector, whatsapp },
        },
        { status: 400 },
      )
    }

    const smsAdapter = new MockSmsAdapter()
    const otpRepository = otpStore

    const registerUserWithOtp = new RegisterUserWithOtp(
      smsAdapter,
      otpRepository,
    )

    const result = await registerUserWithOtp.execute({
      businessName,
      sector,
      yearsOfOperation,
      municipio,
      barrio,
      hasChamber,
      nit,
      whatsapp,
      email,
    })

    return Response.json(
      {
        data: {
          sessionId: result.sessionId,
          message: result.message,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    serverLogger.error('[POST /api/auth/request-otp]', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    return Response.json({ error: message }, { status: 400 })
  }
}
