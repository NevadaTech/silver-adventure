import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only — en vitest no existe el bundler de Next.js
vi.mock('server-only', () => ({}))

// Mock env — no queremos validar process.env en tests de route handler
vi.mock('@/core/shared/infrastructure/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  },
}))

// Mock Supabase server client
const mockFrom = vi.fn()
vi.mock('@/core/shared/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}))

// Import DESPUÉS de los mocks
const { GET } = await import('@/app/api/users/route')

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return users as JSON with correct structure', async () => {
    const mockData = [
      { id: '1', name: 'Ted', created_at: '2026-04-24T12:00:00Z' },
      { id: '2', name: 'Ana', created_at: '2026-04-24T13:00:00Z' },
    ]

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.data[0]).toEqual({
      id: '1',
      name: 'Ted',
      createdAt: '2026-04-24T12:00:00.000Z',
    })
    expect(body.data[1]).toEqual({
      id: '2',
      name: 'Ana',
      createdAt: '2026-04-24T13:00:00.000Z',
    })
  })

  it('should return empty data array when no users exist', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('should return 500 when Supabase query fails', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection refused' },
        }),
      }),
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe('Failed to fetch users')
  })
})
