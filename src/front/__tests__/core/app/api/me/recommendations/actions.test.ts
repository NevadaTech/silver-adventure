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

const mockBrainPost = vi.fn()
const mockBrainDelete = vi.fn()
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
    post: mockBrainPost,
    get: vi.fn(),
    delete: mockBrainDelete,
  },
  BrainHttpError: FakeBrainHttpError,
}))

const { POST, DELETE } =
  await import('@/app/api/me/recommendations/[id]/actions/route')

function buildPostRequest(token: string | null, body: unknown = {}): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token !== null) headers.Authorization = token
  return new Request('http://localhost/api/me/recommendations/rec-1/actions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function buildDeleteRequest(token: string | null, action?: string): Request {
  const headers: Record<string, string> = {}
  if (token !== null) headers.Authorization = token
  const search = action ? `?action=${action}` : ''
  return new Request(
    `http://localhost/api/me/recommendations/rec-1/actions${search}`,
    {
      method: 'DELETE',
      headers,
    },
  )
}

describe('POST /api/me/recommendations/:id/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when bearer token is missing', async () => {
    const response = await POST(buildPostRequest(null), {
      params: Promise.resolve({ id: 'rec-1' }),
    })
    expect(response.status).toBe(401)
    expect(mockBrainPost).not.toHaveBeenCalled()
  })

  it('returns 401 when supabase rejects the token', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid' },
    })
    const response = await POST(buildPostRequest('Bearer x'), {
      params: Promise.resolve({ id: 'rec-1' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 400 on invalid action', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    const response = await POST(
      buildPostRequest('Bearer good', { action: 'wat' }),
      { params: Promise.resolve({ id: 'rec-1' }) },
    )
    expect(response.status).toBe(400)
    expect(mockBrainPost).not.toHaveBeenCalled()
  })

  it('forwards a valid action to the brain', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockBrainPost.mockResolvedValueOnce({
      connection: {
        id: 'c-1',
        userId: 'u-1',
        recommendationId: 'rec-1',
        action: 'saved',
        note: null,
        createdAt: '2026-04-26T10:00:00Z',
      },
    })

    const response = await POST(
      buildPostRequest('Bearer good', { action: 'saved' }),
      { params: Promise.resolve({ id: 'rec-1' }) },
    )

    expect(response.status).toBe(201)
    expect(mockBrainPost).toHaveBeenCalledWith('/api/connections', {
      userId: 'u-1',
      recommendationId: 'rec-1',
      action: 'saved',
      note: null,
    })
  })

  it('maps brain 404 to 404', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockBrainPost.mockRejectedValueOnce(
      new FakeBrainHttpError(
        404,
        { error: 'Recommendation not found: rec-1' },
        'not found',
      ),
    )

    const response = await POST(
      buildPostRequest('Bearer good', { action: 'saved' }),
      { params: Promise.resolve({ id: 'rec-1' }) },
    )
    expect(response.status).toBe(404)
  })

  it('maps unknown brain errors to 502', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockBrainPost.mockRejectedValueOnce(new Error('boom'))

    const response = await POST(
      buildPostRequest('Bearer good', { action: 'saved' }),
      { params: Promise.resolve({ id: 'rec-1' }) },
    )
    expect(response.status).toBe(502)
  })
})

describe('DELETE /api/me/recommendations/:id/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when bearer token is missing', async () => {
    const response = await DELETE(buildDeleteRequest(null, 'saved'), {
      params: Promise.resolve({ id: 'rec-1' }),
    })
    expect(response.status).toBe(401)
  })

  it('returns 400 when action query param is missing or invalid', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u-1' } },
      error: null,
    })

    const noAction = await DELETE(buildDeleteRequest('Bearer good'), {
      params: Promise.resolve({ id: 'rec-1' }),
    })
    expect(noAction.status).toBe(400)

    const badAction = await DELETE(buildDeleteRequest('Bearer good', 'wat'), {
      params: Promise.resolve({ id: 'rec-1' }),
    })
    expect(badAction.status).toBe(400)
  })

  it('delegates to the brain DELETE with the auth user id', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'u-1' } },
      error: null,
    })
    mockBrainDelete.mockResolvedValueOnce(undefined)

    const response = await DELETE(buildDeleteRequest('Bearer good', 'saved'), {
      params: Promise.resolve({ id: 'rec-1' }),
    })

    expect(response.status).toBe(204)
    expect(mockBrainDelete).toHaveBeenCalledTimes(1)
    const path = mockBrainDelete.mock.calls[0][0] as string
    expect(path).toContain('/api/connections?')
    expect(path).toContain('userId=u-1')
    expect(path).toContain('recommendationId=rec-1')
    expect(path).toContain('action=saved')
  })
})
