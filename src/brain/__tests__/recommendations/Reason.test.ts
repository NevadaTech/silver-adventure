import { describe, expect, it } from 'vitest'
import {
  type Reason,
  Reasons,
} from '@/recommendations/domain/value-objects/Reason'

const sample = (overrides: Partial<Reason> = {}): Reason => ({
  feature: 'mismo_ciiu_clase',
  weight: 0.4,
  description: 'Mismo CIIU clase',
  ...overrides,
})

describe('Reasons', () => {
  it('starts empty with zero total weight and empty json', () => {
    const reasons = Reasons.empty()

    expect(reasons.totalWeight()).toBe(0)
    expect(reasons.toJson()).toEqual([])
  })

  it('builds from a list and exposes a defensive copy via toJson', () => {
    const items = [
      sample({ feature: 'mismo_municipio', weight: 0.3 }),
      sample({ feature: 'misma_etapa', weight: 0.2 }),
    ]
    const reasons = Reasons.from(items)

    const json = reasons.toJson()
    expect(json).toEqual(items)
    expect(json).not.toBe(items)

    json.push(sample())
    expect(reasons.toJson()).toHaveLength(2)
  })

  it('add() returns a new instance without mutating the original', () => {
    const original = Reasons.from([sample({ weight: 0.5 })])
    const next = original.add(
      sample({ feature: 'mismo_municipio', weight: 0.3 }),
    )

    expect(original.toJson()).toHaveLength(1)
    expect(next.toJson()).toHaveLength(2)
    expect(next).not.toBe(original)
  })

  it('totalWeight sums the weight of all reasons', () => {
    const reasons = Reasons.from([
      sample({ weight: 0.4 }),
      sample({ feature: 'mismo_municipio', weight: 0.3 }),
      sample({ feature: 'misma_etapa', weight: 0.25 }),
    ])

    expect(reasons.totalWeight()).toBeCloseTo(0.95, 5)
  })

  it('preserves reason metadata (value field) through toJson', () => {
    const reasons = Reasons.from([
      sample({
        feature: 'mismo_municipio',
        weight: 0.3,
        value: 'SANTA MARTA',
        description: 'Misma ciudad',
      }),
    ])

    expect(reasons.toJson()[0]).toEqual({
      feature: 'mismo_municipio',
      weight: 0.3,
      value: 'SANTA MARTA',
      description: 'Misma ciudad',
    })
  })

  it('does not share state when constructed via from()', () => {
    const items = [sample({ weight: 0.4 })]
    const reasons = Reasons.from(items)

    items.push(sample({ feature: 'misma_etapa', weight: 0.9 }))

    expect(reasons.toJson()).toHaveLength(1)
    expect(reasons.totalWeight()).toBe(0.4)
  })
})
