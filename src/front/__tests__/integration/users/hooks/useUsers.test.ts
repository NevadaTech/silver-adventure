// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { SWRConfig } from 'swr'

import { useUsers } from '@/core/users/infrastructure/hooks/useUsers'
import { httpClient } from '@/core/shared/infrastructure/http/httpClient'

/**
 * Mock httpClient.get — no queremos requests reales en tests.
 * Mockeamos el método get directamente (no el módulo entero)
 * porque el interceptor de auth no nos afecta acá.
 */
const mockGet = vi.spyOn(httpClient, 'get')

/**
 * Wrapper que:
 * 1. Resetea cache de SWR entre tests (provider: () => new Map())
 * 2. Configura el fetcher que usa axios internamente
 * 3. Desactiva retry para que los tests de error no se cuelguen
 */
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

describe('useUsers', () => {
  it('should return users on successful fetch', async () => {
    const mockUsers = [
      { id: '1', name: 'Ted', createdAt: '2026-04-24T12:00:00.000Z' },
      { id: '2', name: 'Ana', createdAt: '2026-04-24T13:00:00.000Z' },
    ]

    mockGet.mockResolvedValueOnce({
      data: { data: mockUsers },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.users).toHaveLength(2)
    expect(result.current.users[0].name).toBe('Ted')
    expect(result.current.users[1].name).toBe('Ana')
    expect(result.current.error).toBeUndefined()
  })

  it('should return empty array when no users', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.users).toEqual([])
    expect(result.current.error).toBeUndefined()
  })

  it('should return error on fetch failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Internal Server Error'))

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })

    expect(result.current.error?.message).toBe('Internal Server Error')
    expect(result.current.users).toEqual([])
  })

  it('should call /api/users endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/users')
    })
  })
})
