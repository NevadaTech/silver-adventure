import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/core/shared/infrastructure/env', () => ({
  env: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    BRAIN_API_URL: 'http://localhost:3001',
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

const mockBrainGet = vi.fn()
vi.mock('@/core/shared/infrastructure/brain/brainClient', () => ({
  brainClient: { get: mockBrainGet, post: vi.fn() },
  BrainHttpError: class BrainHttpError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
      message: string,
    ) {
      super(message)
    }
  },
}))

const mockGetUser = vi.fn()
const mockUserSingle = vi.fn()
const mockTaxonomyCodeIn = vi.fn()
const mockTaxonomyDivisionIn = vi.fn()

vi.mock('@/core/shared/infrastructure/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: mockUserSingle,
            }),
          }),
        }
      }
      if (table === 'ciiu_taxonomy') {
        return {
          select: (cols: string) => ({
            in: cols.includes('titulo_actividad')
              ? mockTaxonomyCodeIn
              : mockTaxonomyDivisionIn,
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }),
}))

const { GET } = await import('@/app/api/me/recommendations/grouped/route')

function buildRequest(token = 'good'): Request {
  return new Request('http://localhost/api/me/recommendations/grouped', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

describe('GET /api/me/recommendations/grouped', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockUserSingle.mockResolvedValue({
      data: { company_id: 'co-1' },
      error: null,
    })
    mockTaxonomyCodeIn.mockResolvedValue({
      data: [
        {
          code: '5611',
          titulo_actividad: 'Restaurantes y servicio móvil de comidas',
        },
      ],
      error: null,
    })
    mockTaxonomyDivisionIn.mockResolvedValue({
      data: [
        { division: '56', titulo_division: 'Servicio de comidas y bebidas' },
      ],
      error: null,
    })
  })

  it('returns 401 when there is no Authorization header', async () => {
    const response = await GET(
      new Request('http://localhost/api/me/recommendations/grouped'),
    )
    expect(response.status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('returns no_company partial response when the user has no company linked', async () => {
    mockUserSingle.mockResolvedValueOnce({
      data: { company_id: null },
      error: null,
    })

    const response = await GET(buildRequest())
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      recomendaciones: unknown[]
      partial: boolean
      reason: string
    }
    expect(body).toEqual({
      recomendaciones: [],
      partial: true,
      reason: 'no_company',
    })
    expect(mockBrainGet).not.toHaveBeenCalled()
  })

  it('enriches the brain response with CIIU titles and maps to Recomendacion', async () => {
    mockBrainGet.mockResolvedValueOnce({
      proveedor: [],
      cliente: [],
      aliado: [],
      referente: [
        {
          id: 'r1',
          targetCompany: {
            id: 'co-target',
            razonSocial: 'Restaurante Foo',
            ciiu: '5611',
            ciiuSeccion: 'I',
            ciiuDivision: '56',
            municipio: 'Santa Marta',
            etapa: 'crecimiento',
            personal: 5,
            ingreso: 100,
          },
          relationType: 'referente',
          score: 0.6,
          reasons: [
            {
              feature: 'mismo_ciiu_clase',
              weight: 0.4,
              value: '5611',
              description: 'Misma clase CIIU 5611',
            },
            {
              feature: 'mismo_ciiu_division',
              weight: 0.25,
              value: '56',
              description: 'Misma división CIIU 56',
            },
          ],
          source: 'cosine',
          explanation: null,
        },
      ],
      partial: false,
    })

    const response = await GET(buildRequest())
    expect(response.status).toBe(200)

    const body = (await response.json()) as {
      recomendaciones: Array<{
        target: { sector: string }
        razon: string
      }>
      partial: boolean
      reason: string | null
    }
    expect(body.partial).toBe(false)
    expect(body.reason).toBeNull()
    expect(body.recomendaciones).toHaveLength(1)

    const reco = body.recomendaciones[0]
    expect(reco.target.sector).toBe(
      'Restaurantes y servicio móvil de comidas (CIIU I5611)',
    )
    expect(reco.razon).toContain(
      'Misma clase: Restaurantes y servicio móvil de comidas (CIIU 5611)',
    )
    expect(reco.razon).toContain(
      'Misma división: Servicio de comidas y bebidas (CIIU 56)',
    )

    expect(mockBrainGet).toHaveBeenCalledWith(
      '/api/companies/co-1/recommendations/grouped',
    )
    expect(mockTaxonomyCodeIn).toHaveBeenCalledTimes(1)
    expect(mockTaxonomyDivisionIn).toHaveBeenCalledTimes(1)
  })

  it('returns 502 when the brain call fails', async () => {
    mockBrainGet.mockRejectedValueOnce(new Error('boom'))
    const response = await GET(buildRequest())
    expect(response.status).toBe(502)
  })
})
