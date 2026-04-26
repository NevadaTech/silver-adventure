import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { FeatureVectorBuilder } from '@/recommendations/application/services/FeatureVectorBuilder'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c1',
    razonSocial: 'Acme',
    ciiu: 'G4631',
    municipio: 'SANTA MARTA',
    personal: 10,
    ingresoOperacion: 1_000_000,
    activosTotales: 1_000_000,
    fechaMatricula: new Date('2020-01-01'),
    ...overrides,
  })

describe('FeatureVectorBuilder.build', () => {
  const builder = new FeatureVectorBuilder()

  it('extracts ciiu fields, municipio, etapa ordinal, and log-normalized magnitudes', () => {
    const c = company()
    const v = builder.build(c)

    expect(v.ciiuClase).toBe('4631')
    expect(v.ciiuDivision).toBe('46')
    expect(v.ciiuSeccion).toBe('G')
    expect(v.municipio).toBe('SANTA MARTA')
    expect(v.etapaOrdinal).toBeGreaterThanOrEqual(1)
    expect(v.etapaOrdinal).toBeLessThanOrEqual(4)
    expect(v.personalLog).toBeGreaterThanOrEqual(0)
    expect(v.personalLog).toBeLessThanOrEqual(1)
    expect(v.ingresoLog).toBeGreaterThanOrEqual(0)
    expect(v.ingresoLog).toBeLessThanOrEqual(1)
  })

  it('clamps personal/ingreso below or above the normalization range', () => {
    const small = builder.build(company({ personal: 0, ingresoOperacion: 0 }))
    expect(small.personalLog).toBe(0)
    expect(small.ingresoLog).toBe(0)

    const huge = builder.build(
      company({ personal: 1_000_000, ingresoOperacion: 1e15 }),
    )
    expect(huge.personalLog).toBe(1)
    expect(huge.ingresoLog).toBe(1)
  })

  it('maps each canonical etapa to a distinct ordinal in 1..4', () => {
    const ordinals = new Set<number>()
    for (const fechaMatricula of [
      new Date('2025-06-01'),
      new Date('2022-01-01'),
      new Date('2017-01-01'),
      new Date('2005-01-01'),
    ]) {
      ordinals.add(
        builder.build(
          company({
            fechaMatricula,
            personal: 5,
            ingresoOperacion: 100_000,
          }),
        ).etapaOrdinal,
      )
    }
    expect(ordinals.size).toBeGreaterThan(1)
    for (const o of ordinals) {
      expect([1, 2, 3, 4]).toContain(o)
    }
  })
})

describe('FeatureVectorBuilder.proximity', () => {
  const builder = new FeatureVectorBuilder()

  it('returns ~1 for identical vectors', () => {
    const v = builder.build(company())
    expect(builder.proximity(v, v)).toBeCloseTo(1, 5)
  })

  it('weighs same municipio more than same etapa', () => {
    const a = builder.build(company({ id: 'a' }))
    const sameMunicipio = builder.build(
      company({
        id: 'b',
        municipio: 'SANTA MARTA',
        fechaMatricula: new Date('2005-01-01'),
        personal: 200,
        ingresoOperacion: 500_000_000,
      }),
    )
    const sameEtapa = builder.build(
      company({
        id: 'c',
        municipio: 'CARTAGENA',
        fechaMatricula:
          a.etapaOrdinal === 2
            ? new Date('2020-01-01')
            : new Date('2022-01-01'),
        personal: 200,
        ingresoOperacion: 500_000_000,
      }),
    )
    expect(builder.proximity(a, sameMunicipio)).toBeGreaterThan(
      builder.proximity(a, sameEtapa),
    )
  })

  it('caps at 1', () => {
    const a = builder.build(company({ id: 'a' }))
    const b = builder.build(company({ id: 'b' }))
    expect(builder.proximity(a, b)).toBeLessThanOrEqual(1)
  })

  it('drops to lower scores when municipio and etapa differ and magnitudes are far apart', () => {
    const a = builder.build(
      company({ id: 'a', personal: 1, ingresoOperacion: 100 }),
    )
    const b = builder.build(
      company({
        id: 'b',
        municipio: 'CARTAGENA',
        fechaMatricula: new Date('2005-01-01'),
        personal: 5000,
        ingresoOperacion: 1e13,
      }),
    )
    expect(builder.proximity(a, b)).toBeLessThan(0.5)
  })
})
