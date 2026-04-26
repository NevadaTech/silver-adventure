import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/core/shared/infrastructure/logger/serverLogger', () => ({
  serverLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

const { enrichWithCiiuTitles } =
  await import('@/core/recommendations/infrastructure/adapters/enrichWithCiiuTitles')
const { serverLogger } =
  await import('@/core/shared/infrastructure/logger/serverLogger')

import type {
  BrainGroupedRecommendationsResponse,
  BrainRecommendationView,
} from '@/core/shared/infrastructure/brain/brainClient'

type CodeRow = { code: string; titulo_actividad: string }
type DivisionRow = { division: string; titulo_division: string }

interface SupabaseSetup {
  codeRows?: CodeRow[]
  divisionRows?: DivisionRow[]
  codeError?: { message: string }
  divisionError?: { message: string }
}

function makeSupabase(setup: SupabaseSetup = {}) {
  const codeIn = vi.fn((_col: string, _vals: string[]) =>
    Promise.resolve(
      setup.codeError
        ? { data: null, error: setup.codeError }
        : { data: setup.codeRows ?? [], error: null },
    ),
  )
  const divisionIn = vi.fn((_col: string, _vals: string[]) =>
    Promise.resolve(
      setup.divisionError
        ? { data: null, error: setup.divisionError }
        : { data: setup.divisionRows ?? [], error: null },
    ),
  )
  const select = vi.fn((cols: string) => ({
    in: cols.includes('titulo_actividad') ? codeIn : divisionIn,
  }))
  const from = vi.fn(() => ({ select }))
  return {
    client: { from } as unknown as Parameters<typeof enrichWithCiiuTitles>[1],
    spies: { from, select, codeIn, divisionIn },
  }
}

function makeView(
  overrides: Partial<BrainRecommendationView>,
): BrainRecommendationView {
  return {
    id: overrides.id ?? 'r',
    targetCompany:
      overrides.targetCompany === undefined
        ? {
            id: 'co',
            razonSocial: 'Foo SAS',
            ciiu: '5611',
            ciiuSeccion: 'I',
            ciiuDivision: '56',
            municipio: 'SANTA MARTA',
            etapa: 'crecimiento',
            personal: 1,
            ingreso: 0,
          }
        : overrides.targetCompany,
    relationType: overrides.relationType ?? 'referente',
    score: overrides.score ?? 0.6,
    reasons: overrides.reasons ?? [],
    source: overrides.source ?? 'cosine',
    explanation: overrides.explanation ?? null,
  }
}

function makeGrouped(
  overrides: Partial<BrainGroupedRecommendationsResponse> = {},
): BrainGroupedRecommendationsResponse {
  return {
    proveedor: overrides.proveedor ?? [],
    cliente: overrides.cliente ?? [],
    aliado: overrides.aliado ?? [],
    referente: overrides.referente ?? [],
    partial: overrides.partial ?? false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('enrichWithCiiuTitles', () => {
  it('populates targetCompany.ciiuTitulo and rewrites mismo_ciiu_clase / mismo_ciiu_division descriptions', async () => {
    const grouped = makeGrouped({
      referente: [
        makeView({
          id: 'r1',
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
            {
              feature: 'misma_etapa',
              weight: 0.2,
              value: 'crecimiento',
              description: 'Misma etapa: crecimiento',
            },
          ],
        }),
      ],
    })

    const { client } = makeSupabase({
      codeRows: [
        {
          code: '5611',
          titulo_actividad: 'Restaurantes y servicio móvil de comidas',
        },
      ],
      divisionRows: [
        { division: '56', titulo_division: 'Servicio de comidas y bebidas' },
      ],
    })

    const result = await enrichWithCiiuTitles(grouped, client)

    expect(result.referente[0].targetCompany?.ciiuTitulo).toBe(
      'Restaurantes y servicio móvil de comidas',
    )
    const reasons = result.referente[0].reasons
    expect(reasons[0].description).toBe(
      'Misma clase: Restaurantes y servicio móvil de comidas (CIIU 5611)',
    )
    expect(reasons[1].description).toBe(
      'Misma división: Servicio de comidas y bebidas (CIIU 56)',
    )
    expect(reasons[2].description).toBe('Misma etapa: crecimiento')
  })

  it('leaves descriptions for unrelated features untouched', async () => {
    const grouped = makeGrouped({
      proveedor: [
        makeView({
          id: 'p1',
          relationType: 'proveedor',
          reasons: [
            {
              feature: 'cadena_valor_directa',
              weight: 0.85,
              value: '4631',
              description: 'Mayorista de alimentos abastece restaurantes',
            },
            {
              feature: 'mismo_municipio',
              weight: 0.3,
              value: 'SANTA MARTA',
              description: 'Mismo municipio: SANTA MARTA',
            },
          ],
        }),
      ],
    })

    const { client } = makeSupabase({
      codeRows: [
        {
          code: '5611',
          titulo_actividad: 'Restaurantes y servicio móvil de comidas',
        },
      ],
      divisionRows: [
        { division: '56', titulo_division: 'Servicio de comidas y bebidas' },
      ],
    })

    const result = await enrichWithCiiuTitles(grouped, client)
    const reasons = result.proveedor[0].reasons
    expect(reasons[0].description).toBe(
      'Mayorista de alimentos abastece restaurantes',
    )
    expect(reasons[1].description).toBe('Mismo municipio: SANTA MARTA')
  })

  it('keeps the original description when the code is not in taxonomy', async () => {
    const grouped = makeGrouped({
      referente: [
        makeView({
          targetCompany: {
            id: 'co',
            razonSocial: 'Foo SAS',
            ciiu: '9999',
            ciiuSeccion: 'X',
            ciiuDivision: '99',
            municipio: 'SANTA MARTA',
            etapa: 'crecimiento',
            personal: 1,
            ingreso: 0,
          },
          reasons: [
            {
              feature: 'mismo_ciiu_clase',
              weight: 0.4,
              value: '9999',
              description: 'Misma clase CIIU 9999',
            },
          ],
        }),
      ],
    })
    const { client } = makeSupabase()

    const result = await enrichWithCiiuTitles(grouped, client)
    expect(result.referente[0].targetCompany?.ciiuTitulo).toBeUndefined()
    expect(result.referente[0].reasons[0].description).toBe(
      'Misma clase CIIU 9999',
    )
  })

  it('issues two parallel queries covering all unique codes and divisions', async () => {
    const grouped = makeGrouped({
      proveedor: [
        makeView({
          id: 'p1',
          relationType: 'proveedor',
          targetCompany: {
            id: 'co1',
            razonSocial: 'Co1',
            ciiu: '5611',
            ciiuSeccion: 'I',
            ciiuDivision: '56',
            municipio: 'X',
            etapa: 'crecimiento',
            personal: 0,
            ingreso: 0,
          },
          reasons: [],
        }),
      ],
      referente: [
        makeView({
          id: 'r1',
          targetCompany: {
            id: 'co2',
            razonSocial: 'Co2',
            ciiu: '4631',
            ciiuSeccion: 'G',
            ciiuDivision: '46',
            municipio: 'Y',
            etapa: 'crecimiento',
            personal: 0,
            ingreso: 0,
          },
          reasons: [
            {
              feature: 'mismo_ciiu_clase',
              weight: 0.4,
              value: '4631',
              description: 'Misma clase CIIU 4631',
            },
            {
              feature: 'mismo_ciiu_division',
              weight: 0.25,
              value: '47',
              description: 'Misma división CIIU 47',
            },
          ],
        }),
      ],
    })

    const { client, spies } = makeSupabase()
    await enrichWithCiiuTitles(grouped, client)

    expect(spies.from).toHaveBeenCalledTimes(2)
    expect(spies.from).toHaveBeenCalledWith('ciiu_taxonomy')

    expect(spies.codeIn).toHaveBeenCalledTimes(1)
    const codeArgs = spies.codeIn.mock.calls[0]
    expect(codeArgs[0]).toBe('code')
    expect(new Set(codeArgs[1])).toEqual(new Set(['5611', '4631']))

    expect(spies.divisionIn).toHaveBeenCalledTimes(1)
    const divArgs = spies.divisionIn.mock.calls[0]
    expect(divArgs[0]).toBe('division')
    expect(new Set(divArgs[1])).toEqual(new Set(['56', '46', '47']))
  })

  it('returns the grouped response untouched when there are no codes to look up', async () => {
    const grouped = makeGrouped()
    const { client, spies } = makeSupabase()

    const result = await enrichWithCiiuTitles(grouped, client)
    expect(result).toBe(grouped)
    expect(spies.from).not.toHaveBeenCalled()
  })

  it('logs a warning and keeps the original descriptions on Supabase errors', async () => {
    const grouped = makeGrouped({
      referente: [
        makeView({
          reasons: [
            {
              feature: 'mismo_ciiu_clase',
              weight: 0.4,
              value: '5611',
              description: 'Misma clase CIIU 5611',
            },
          ],
        }),
      ],
    })
    const { client } = makeSupabase({
      codeError: { message: 'connection refused' },
    })

    const result = await enrichWithCiiuTitles(grouped, client)
    expect(result.referente[0].reasons[0].description).toBe(
      'Misma clase CIIU 5611',
    )
    expect(result.referente[0].targetCompany?.ciiuTitulo).toBeUndefined()
    expect(serverLogger.warn).toHaveBeenCalled()
  })
})
