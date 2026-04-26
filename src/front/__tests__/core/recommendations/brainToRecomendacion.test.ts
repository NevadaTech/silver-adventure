import { describe, expect, it } from 'vitest'
import {
  mapBrainGroupedToRecomendaciones,
  mapBrainViewToRecomendacion,
} from '@/core/recommendations/infrastructure/adapters/brainToRecomendacion'
import type { BrainRecommendationView } from '@/core/shared/infrastructure/brain/brainClient'

const targetCompany = {
  id: 'co-42',
  razonSocial: 'Doña Lucía Lavandería',
  ciiu: '9601',
  ciiuSeccion: 'S',
  ciiuDivision: '96',
  municipio: 'SANTA MARTA',
  etapa: 'crecimiento',
  personal: 3,
  ingreso: 12_000_000,
}

const view = (
  overrides: Partial<BrainRecommendationView> = {},
): BrainRecommendationView => ({
  id: 'r1',
  targetCompany,
  relationType: 'proveedor',
  score: 0.9234,
  reasons: [
    {
      feature: 'cadena_valor_directa',
      weight: 0.7,
      description: 'Lavandería sirve a hoteles boutique',
    },
  ],
  source: 'rule',
  explanation: null,
  ...overrides,
})

describe('mapBrainViewToRecomendacion', () => {
  it('maps target company into Actor and rounds score to 0–100', () => {
    const result = mapBrainViewToRecomendacion(view())!
    expect(result.id).toBe('r1')
    expect(result.target.id).toBe('co-42')
    expect(result.target.nombre).toBe('Doña Lucía Lavandería')
    expect(result.target.iniciales).toBe('DL')
    expect(result.target.barrio).toBe('SANTA MARTA')
    expect(result.target.origen).toBe('formal')
    expect(result.target.avatarColor).toMatch(/^bg-/)
    expect(result.score).toBe(92)
    expect(result.tipoRelacion).toBe('proveedor')
    expect(result.estado).toBe('nueva')
  })

  it('uses explanation as razon when available', () => {
    const result = mapBrainViewToRecomendacion(
      view({ explanation: 'Tres hoteles cercanos ya trabajan con ellos.' }),
    )!
    expect(result.razon).toBe('Tres hoteles cercanos ya trabajan con ellos.')
  })

  it('joins reasons descriptions when explanation is null', () => {
    const result = mapBrainViewToRecomendacion(
      view({
        reasons: [
          { feature: 'a', weight: 0.5, description: 'Misma división CIIU' },
          { feature: 'b', weight: 0.3, description: 'Mismo municipio' },
        ],
      }),
    )!
    expect(result.razon).toContain('Misma división CIIU')
    expect(result.razon).toContain('Mismo municipio')
  })

  it('returns null when targetCompany is missing', () => {
    expect(
      mapBrainViewToRecomendacion(view({ targetCompany: null })),
    ).toBeNull()
  })

  it('builds anclas (max 3) from the brain reasons', () => {
    const result = mapBrainViewToRecomendacion(
      view({
        reasons: Array.from({ length: 5 }, (_, i) => ({
          feature: `f${i}`,
          weight: 0.1,
          description: `desc-${i}`,
        })),
      }),
    )!
    expect(result.anclas).toHaveLength(3)
  })

  it('produces stable avatar color per company id', () => {
    const a = mapBrainViewToRecomendacion(view())!
    const b = mapBrainViewToRecomendacion(view())!
    expect(a.target.avatarColor).toBe(b.target.avatarColor)
  })

  it('falls back to "CIIU {seccion}{ciiu}" when ciiuTitulo is missing', () => {
    const result = mapBrainViewToRecomendacion(view())!
    expect(result.target.sector).toBe('CIIU S9601')
  })

  it('uses the human-readable name with the code in parentheses when ciiuTitulo is provided', () => {
    const result = mapBrainViewToRecomendacion(
      view({
        targetCompany: {
          ...targetCompany,
          ciiuTitulo: 'Lavado y limpieza de prendas de vestir',
        },
      }),
    )!
    expect(result.target.sector).toBe(
      'Lavado y limpieza de prendas de vestir (CIIU S9601)',
    )
  })
})

describe('mapBrainGroupedToRecomendaciones', () => {
  it('flattens all relation types and drops null targets', () => {
    const result = mapBrainGroupedToRecomendaciones({
      proveedor: [view({ id: 'p1' })],
      cliente: [view({ id: 'c1', relationType: 'cliente' })],
      aliado: [],
      referente: [view({ id: 'r1', targetCompany: null })],
      partial: false,
    })
    expect(result.map((r) => r.id).sort()).toEqual(['c1', 'p1'])
  })
})
