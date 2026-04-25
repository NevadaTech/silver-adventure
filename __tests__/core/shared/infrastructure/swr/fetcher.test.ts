import { describe, it, expect, vi, beforeEach } from 'vitest'

import { httpClient } from '@/core/shared/infrastructure/http/httpClient'
import { fetcher } from '@/core/shared/infrastructure/swr/fetcher'

vi.spyOn(httpClient, 'get')
const mockGet = vi.mocked(httpClient.get)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetcher', () => {
  it('calls httpClient.get with the URL and returns response data', async () => {
    const mockData = { users: [{ id: '1', name: 'Ted' }] }

    mockGet.mockResolvedValueOnce({
      data: mockData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    const result = await fetcher('/api/users')

    expect(mockGet).toHaveBeenCalledWith('/api/users', {
      signal: expect.any(AbortSignal),
    })
    expect(result).toEqual(mockData)
  })

  it('propagates errors from httpClient', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'))

    await expect(fetcher('/api/users')).rejects.toThrow('Network Error')
  })
})
