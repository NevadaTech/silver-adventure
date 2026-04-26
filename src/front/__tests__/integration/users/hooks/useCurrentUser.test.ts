// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { SWRConfig } from 'swr'

import { httpClient } from '@/core/shared/infrastructure/http/httpClient'
import { useCurrentUser } from '@/core/users/infrastructure/hooks/useCurrentUser'

const mockGet = vi.spyOn(httpClient, 'get')

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      SWRConfig,
      {
        value: {
          dedupingInterval: 0,
          provider: () => new Map(),
          shouldRetryOnError: false,
          fetcher: async (url: string) => {
            const res = await httpClient.get(url)
            return res.data
          },
        },
      },
      children,
    )
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useCurrentUser', () => {
  it('maps the API response to a CurrentUser DTO and computes initials', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u-1',
          name: 'Hotel Brisas Marinas',
          email: 'hola@brisas.com',
          sector: 'turismo',
          barrio: 'Rodadero',
          municipio: 'Santa Marta',
          companyId: 'co-9',
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toEqual({
      id: 'u-1',
      nombre: 'Hotel Brisas Marinas',
      empresa: 'Hotel Brisas Marinas',
      iniciales: 'HB',
      sector: 'turismo',
      barrio: 'Rodadero',
    })
    expect(result.current.error).toBeUndefined()
  })

  it('falls back to the first two characters when the name is a single word', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u-2',
          name: 'Empanadas',
          email: null,
          sector: null,
          barrio: null,
          municipio: null,
          companyId: null,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user?.iniciales).toBe('EM')
    expect(result.current.user?.sector).toBe('')
    expect(result.current.user?.barrio).toBe('')
  })

  it('uses raw slice fallback when the name has no alphabetic words', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u-3',
          name: '🏪',
          email: null,
          sector: null,
          barrio: null,
          municipio: null,
          companyId: null,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user?.iniciales).toBe('🏪'.slice(0, 2).toUpperCase())
  })

  it('exposes errors when the request fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Unauthorized'))

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })

    expect(result.current.user).toBeUndefined()
    expect(result.current.error?.message).toBe('Unauthorized')
  })

  it('calls /api/me', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u-1',
          name: 'X Y',
          email: null,
          sector: null,
          barrio: null,
          municipio: null,
          companyId: null,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderHook(() => useCurrentUser(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/me')
    })
  })
})
