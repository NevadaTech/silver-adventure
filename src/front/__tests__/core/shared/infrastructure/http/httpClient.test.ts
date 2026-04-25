import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'

/**
 * Tests para httpClient — interceptors de auth y error.
 *
 * Usamos vi.resetModules() + dynamic import para fresh instances.
 * Mock adapter captura el config DESPUÉS de que todos los interceptors corrieron.
 */

beforeEach(() => {
  vi.resetModules()
})

describe('httpClient', () => {
  describe('auth interceptor', () => {
    it('should NOT add Authorization header when no token provider is set', async () => {
      const { httpClient } =
        await import('@/core/shared/infrastructure/http/httpClient')

      let capturedConfig: InternalAxiosRequestConfig | null = null

      httpClient.defaults.adapter = async (config) => {
        capturedConfig = config
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      await httpClient.get('/test')

      expect(capturedConfig).not.toBeNull()
      expect(capturedConfig!.headers.Authorization).toBeUndefined()
    })

    it('should add Authorization header when token provider returns a token', async () => {
      const { httpClient, setTokenProvider } =
        await import('@/core/shared/infrastructure/http/httpClient')

      setTokenProvider(() => 'my-jwt-token')

      let capturedConfig: InternalAxiosRequestConfig | null = null

      httpClient.defaults.adapter = async (config) => {
        capturedConfig = config
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      await httpClient.get('/test')

      expect(capturedConfig!.headers.Authorization).toBe('Bearer my-jwt-token')
    })

    it('should support async token provider', async () => {
      const { httpClient, setTokenProvider } =
        await import('@/core/shared/infrastructure/http/httpClient')

      setTokenProvider(async () => 'async-token')

      let capturedConfig: InternalAxiosRequestConfig | null = null

      httpClient.defaults.adapter = async (config) => {
        capturedConfig = config
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      await httpClient.get('/test')

      expect(capturedConfig!.headers.Authorization).toBe('Bearer async-token')
    })

    it('should NOT add Authorization header when token provider returns null', async () => {
      const { httpClient, setTokenProvider } =
        await import('@/core/shared/infrastructure/http/httpClient')

      setTokenProvider(() => null)

      let capturedConfig: InternalAxiosRequestConfig | null = null

      httpClient.defaults.adapter = async (config) => {
        capturedConfig = config
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      await httpClient.get('/test')

      expect(capturedConfig!.headers.Authorization).toBeUndefined()
    })
  })

  describe('response error interceptor', () => {
    it('should normalize error with server message', async () => {
      const { httpClient } =
        await import('@/core/shared/infrastructure/http/httpClient')

      httpClient.defaults.adapter = () =>
        Promise.reject({
          response: {
            status: 400,
            data: { error: 'Validation failed' },
          },
          message: 'Request failed with status code 400',
          isAxiosError: true,
        })

      try {
        await httpClient.get('/test')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toBe('Validation failed')
      }
    })

    it('should use fallback message when no server error', async () => {
      const { httpClient } =
        await import('@/core/shared/infrastructure/http/httpClient')

      httpClient.defaults.adapter = () =>
        Promise.reject({
          response: {
            status: 500,
            data: {},
          },
          message: 'Request failed with status code 500',
          isAxiosError: true,
        })

      try {
        await httpClient.get('/test')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toBe(
          'Request failed with status code 500',
        )
      }
    })

    it('should use generic fallback when error has no message at all', async () => {
      const { httpClient } =
        await import('@/core/shared/infrastructure/http/httpClient')

      httpClient.defaults.adapter = () =>
        Promise.reject({
          response: { status: 500, data: {} },
          // No message, no server error — hits the final ?? fallback
          message: undefined,
          isAxiosError: true,
        })

      try {
        await httpClient.get('/test')
        expect.fail('Should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toBe('An unexpected error occurred')
      }
    })
  })

  describe('configuration', () => {
    it('should have correct default baseURL', async () => {
      const { httpClient } =
        await import('@/core/shared/infrastructure/http/httpClient')
      expect(httpClient.defaults.baseURL).toBe('/')
    })

    it('should have 10s timeout', async () => {
      const { httpClient } =
        await import('@/core/shared/infrastructure/http/httpClient')
      expect(httpClient.defaults.timeout).toBe(10_000)
    })

    it('should have JSON content type', async () => {
      const { httpClient } =
        await import('@/core/shared/infrastructure/http/httpClient')
      expect(httpClient.defaults.headers['Content-Type']).toBe(
        'application/json',
      )
    })
  })
})
