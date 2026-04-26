import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/core/shared/infrastructure/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    BRAIN_API_URL: 'http://brain.test',
  },
}))

vi.mock('@/core/shared/infrastructure/logger/serverLogger', () => ({
  serverLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockGetUser = vi.fn()
vi.mock('@/core/shared/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

const mockBrainGet = vi.fn()
class FakeBrainHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message)
    this.name = 'BrainHttpError'
  }
}
vi.mock('@/core/shared/infrastructure/brain/brainClient', () => ({
  brainClient: {
    get: mockBrainGet,
    post: vi.fn(),
    delete: vi.fn(),
  },
  BrainHttpError: FakeBrainHttpError,
}))

const { GET } = await import('@/app/api/me/connections/route')

function buildRequest(token: string | null): Request {
  const headers: Record<string, string> = {}
  if (token !== null) headers.Authorization = token
  return new Request('http://localhost/api/me/connections', { headers })
}

describe('GET /api/me/connections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no bearer token is provided', async () => {
    const response = await GET(buildRequest(null))
    expect(response.status).toBe(401)
    expect(mockBrainGet).not.toHaveBeenCalled()
  })

  it('forwards the request to the brain with the resolved user id', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-42' } },
      error: null,
    })
    mockBrainGet.mockResolvedValueOnce({ connections: [] })

    const response = await GET(buildRequest('Bearer good'))
    expect(response.status).toBe(200)
    expect(mockBrainGet).toHaveBeenCalledWith('/api/users/u-42/connections')
  })

  it('returns 502 when the brain fails', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-42' } },
      error: null,
    })
    mockBrainGet.mockRejectedValueOnce(
      new FakeBrainHttpError(500, { error: 'kaboom' }, 'brain down'),
    )

    const response = await GET(buildRequest('Bearer good'))
    expect(response.status).toBe(502)
  })
})
