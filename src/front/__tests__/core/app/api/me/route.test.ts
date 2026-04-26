import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/core/shared/infrastructure/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
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

const { GET } = await import('@/app/api/me/route')

function buildRequest(token: string | null): Request {
  const headers: Record<string, string> = {}
  if (token !== null) headers.Authorization = token
  return new Request('http://localhost/api/me', { headers })
}

describe('GET /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const response = await GET(buildRequest(null))
    expect(response.status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid token' },
    })

    const response = await GET(buildRequest('Bearer bad-token'))
    expect(response.status).toBe(401)
    expect(mockGetUser).toHaveBeenCalledWith('bad-token')
  })

  it('returns 404 when user has no profile in public.users', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'no rows' },
    })

    const response = await GET(buildRequest('Bearer good-token'))
    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe('Profile not found')
  })

  it('returns mapped profile on happy path', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'user-123',
        name: 'Hotel Brisas',
        email: 'hola@hotelbrisas.com',
        sector: 'turismo',
        barrio: 'Rodadero',
        municipio: 'Santa Marta',
        company_id: 'co-9',
      },
      error: null,
    })

    const response = await GET(buildRequest('Bearer good-token'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      user: {
        id: string
        name: string
        email: string
        sector: string
        barrio: string
        municipio: string
        companyId: string
      }
    }
    expect(body.user).toEqual({
      id: 'user-123',
      name: 'Hotel Brisas',
      email: 'hola@hotelbrisas.com',
      sector: 'turismo',
      barrio: 'Rodadero',
      municipio: 'Santa Marta',
      companyId: 'co-9',
    })
    expect(mockSelect).toHaveBeenCalledWith(
      'id, name, email, sector, barrio, municipio, company_id',
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'user-123')
  })

  it('strips bearer prefix case-insensitively', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'user-123',
        name: 'X',
        email: null,
        sector: null,
        barrio: null,
        municipio: null,
        company_id: null,
      },
      error: null,
    })

    const response = await GET(buildRequest('bearer  TOK '))
    expect(response.status).toBe(200)
    expect(mockGetUser).toHaveBeenCalledWith('TOK')
  })
})
