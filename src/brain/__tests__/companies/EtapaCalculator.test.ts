import { describe, expect, it } from 'vitest'
import { EtapaCalculator } from '@/companies/domain/services/EtapaCalculator'

describe('EtapaCalculator', () => {
  const baseDate = new Date('2026-04-25')

  it('classifies as nacimiento when < 2 years and personal <= 2', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2024-06-01'),
          personal: 1,
          ingreso: 0,
        },
        baseDate,
      ),
    ).toBe('nacimiento')
  })

  it('classifies as crecimiento when 2-7 years and personal 3-50', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2022-01-01'),
          personal: 10,
          ingreso: 100_000_000,
        },
        baseDate,
      ),
    ).toBe('crecimiento')
  })

  it('classifies as consolidacion when > 7 years', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2015-01-01'),
          personal: 30,
          ingreso: 500_000_000,
        },
        baseDate,
      ),
    ).toBe('consolidacion')
  })

  it('classifies as madurez when personal > 200', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2010-01-01'),
          personal: 250,
          ingreso: 100_000_000,
        },
        baseDate,
      ),
    ).toBe('madurez')
  })

  it('classifies as madurez when ingreso > 5000M', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: new Date('2020-01-01'),
          personal: 50,
          ingreso: 6_000_000_000,
        },
        baseDate,
      ),
    ).toBe('madurez')
  })

  it('handles missing fechaMatricula by falling back to personal/ingreso signals', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: null,
          personal: 1,
          ingreso: 0,
        },
        baseDate,
      ),
    ).toBe('nacimiento')
  })

  it('with no fechaMatricula and personal <= 50 falls back to crecimiento', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: null,
          personal: 20,
          ingreso: 200_000_000,
        },
        baseDate,
      ),
    ).toBe('crecimiento')
  })

  it('with no fechaMatricula and personal > 50 falls back to consolidacion', () => {
    expect(
      EtapaCalculator.calculate(
        {
          fechaMatricula: null,
          personal: 100,
          ingreso: 500_000_000,
        },
        baseDate,
      ),
    ).toBe('consolidacion')
  })
})
