import { useState } from 'react'
import { httpClient } from '@/core/shared/infrastructure/http/httpClient'

interface RegisterWithOtpInput {
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

interface RegisterWithOtpResponse {
  data: {
    sessionId: string
    message: string
  }
}

interface UseRegisterWithOtpReturn {
  requestOtp: (
    input: RegisterWithOtpInput,
  ) => Promise<RegisterWithOtpResponse['data'] | null>
  isLoading: boolean
  error?: Error
}

export function useRegisterWithOtp(): UseRegisterWithOtpReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error>()

  const requestOtp = async (input: RegisterWithOtpInput) => {
    setIsLoading(true)
    setError(undefined)

    try {
      const response = await httpClient.post<RegisterWithOtpResponse>(
        '/api/auth/request-otp',
        input,
      )

      return response.data.data
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to request OTP')
      setError(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { requestOtp, isLoading, error }
}
