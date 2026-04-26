import { useState } from 'react'
import { httpClient } from '@/core/shared/infrastructure/http/httpClient'

interface RegisterInput {
  email: string
  password: string
  name: string
}

interface RegisterResponse {
  data: {
    user: {
      id: string
      name: string
      email: string
      createdAt: string
    }
  }
}

interface UseRegisterReturn {
  register: (input: RegisterInput) => Promise<void>
  isLoading: boolean
  error?: Error
  user?: RegisterResponse['data']['user']
}

export function useRegister(): UseRegisterReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error>()
  const [user, setUser] = useState<RegisterResponse['data']['user']>()

  const register = async (input: RegisterInput) => {
    setIsLoading(true)
    setError(undefined)

    try {
      const response = await httpClient.post<RegisterResponse>(
        '/api/auth/register',
        input,
      )

      setUser(response.data.data.user)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Registration failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return { register, isLoading, error, user }
}
