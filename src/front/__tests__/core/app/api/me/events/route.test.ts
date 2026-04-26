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
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
vi.mock('@/core/shared/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
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
  brainClient: { get: mockBrainGet, post: vi.fn(), delete: vi.fn() },
  BrainHttpError: FakeBrainHttpError,
}))

const { GET } = await import('@/app/api/me/events/route')

function buildRequest(token: string | null, search = ''): Request {
  const headers: Record<string, string> = {}
  if (token !== null) headers.Authorization = token
  return new Request(`http://localhost/api/me/events${search}`, { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/me/events', () => {
  it('returns 401 when bearer is missing', async () => {
    const response = await GET(buildRequest(null))
    expect(response.status).toBe(401)
  })

  it('returns empty list with reason when user has no company', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: { company_id: null },
      error: null,
    })

    const response = await GET(buildRequest('Bearer good'))
    const body = (await response.json()) as {
      events: unknown[]
      reason: string
    }
    expect(body.events).toEqual([])
    expect(body.reason).toBe('no_company')
  })

  it('forwards companyId and unread/limit to brain', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: { company_id: 'comp-1' },
      error: null,
    })
    mockBrainGet.mockResolvedValueOnce({ events: [] })

    await GET(buildRequest('Bearer good', '?unread=true&limit=5'))

    const url = mockBrainGet.mock.calls[0][0] as string
    expect(url).toContain('/api/agent/events?')
    expect(url).toContain('companyId=comp-1')
    expect(url).toContain('limit=5')
    expect(url).toContain('unread=true')
  })

  it('returns 502 when brain fails', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: { company_id: 'comp-1' },
      error: null,
    })
    mockBrainGet.mockRejectedValueOnce(
      new FakeBrainHttpError(500, { error: 'kaboom' }, 'down'),
    )

    const response = await GET(buildRequest('Bearer good'))
    expect(response.status).toBe(502)
  })
})
