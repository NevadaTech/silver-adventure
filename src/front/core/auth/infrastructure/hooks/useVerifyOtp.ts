import { useState } from 'react'
import { httpClient } from '@/core/shared/infrastructure/http/httpClient'

interface VerifyOtpResponse {
  data: {
    user: {
      id: string
      name: string
      email: string
      createdAt: string
    }
  }
}

interface UseVerifyOtpReturn {
  verifyOtp: (
    sessionId: string,
    code: string,
  ) => Promise<VerifyOtpResponse['data'] | null>
  isLoading: boolean
  error?: Error
  user?: VerifyOtpResponse['data']['user']
}

export function useVerifyOtp(): UseVerifyOtpReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error>()
  const [user, setUser] = useState<VerifyOtpResponse['data']['user']>()

  const verifyOtp = async (sessionId: string, code: string) => {
    setIsLoading(true)
    setError(undefined)

    try {
      const response = await httpClient.post<VerifyOtpResponse>(
        '/api/auth/verify-otp',
        { sessionId, code },
      )

      setUser(response.data.data.user)
      return response.data.data
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('OTP verification failed')
      setError(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { verifyOtp, isLoading, error, user }
}
