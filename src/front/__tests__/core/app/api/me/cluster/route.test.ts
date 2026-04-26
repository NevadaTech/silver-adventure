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

const { GET } = await import('@/app/api/me/cluster/route')

function buildRequest(token: string | null): Request {
  const headers: Record<string, string> = {}
  if (token !== null) headers.Authorization = token
  return new Request('http://localhost/api/me/cluster', { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/me/cluster', () => {
  it('returns 401 when bearer is missing', async () => {
    const response = await GET(buildRequest(null))
    expect(response.status).toBe(401)
  })

  it('returns no_company when the user has no linked company', async () => {
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
      cluster: null
      reason: 'no_company'
    }
    expect(body.reason).toBe('no_company')
    expect(body.cluster).toBeNull()
  })

  it('returns no_cluster when company is not part of any cluster', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: { company_id: 'comp-1' },
      error: null,
    })
    mockBrainGet.mockResolvedValueOnce([])

    const response = await GET(buildRequest('Bearer good'))
    const body = (await response.json()) as { reason: string }
    expect(body.reason).toBe('no_cluster')
  })

  it('picks the largest predefined cluster and fetches members', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: { company_id: 'comp-1' },
      error: null,
    })
    mockBrainGet
      .mockResolvedValueOnce([
        { id: 'pred-7', tipo: 'predefined', memberCount: 50 },
        { id: 'pred-8', tipo: 'predefined', memberCount: 200 },
        { id: 'div-47-MUN', tipo: 'heuristic-division', memberCount: 80 },
      ])
      .mockResolvedValueOnce({
        cluster: { id: 'pred-8' },
        members: [],
        valueChains: [],
        partial: false,
      })

    const response = await GET(buildRequest('Bearer good'))
    expect(response.status).toBe(200)
    expect(mockBrainGet).toHaveBeenNthCalledWith(
      1,
      '/api/companies/comp-1/clusters',
    )
    expect(mockBrainGet).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/clusters/pred-8/members'),
    )
    const url = mockBrainGet.mock.calls[1][0] as string
    expect(url).toContain('perspectiveCompanyId=comp-1')
  })
})
