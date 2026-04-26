import { describe, expect, it } from 'vitest'
import {
  ECOSYSTEMS,
  VALUE_CHAIN_RULES,
  findRulesForPair,
  findEcosystemsContaining,
  type Ecosystem,
  type ValueChainRule,
} from '@/recommendations/application/services/ValueChainRules'

describe('VALUE_CHAIN_RULES', () => {
  it('exposes 24 rules', () => {
    expect(VALUE_CHAIN_RULES).toHaveLength(24)
  })

  it('every rule has a 4-digit ciiuOrigen', () => {
    for (const rule of VALUE_CHAIN_RULES) {
      expect(rule.ciiuOrigen).toMatch(/^\d{4}$/)
    }
  })

  it('every rule has a 4-digit ciiuDestino or wildcard *', () => {
    for (const rule of VALUE_CHAIN_RULES) {
      expect(rule.ciiuDestino === '*' || /^\d{4}$/.test(rule.ciiuDestino)).toBe(
        true,
      )
    }
  })

  it('every rule has a weight in (0, 1]', () => {
    for (const rule of VALUE_CHAIN_RULES) {
      expect(rule.weight).toBeGreaterThan(0)
      expect(rule.weight).toBeLessThanOrEqual(1)
    }
  })

  it('every rule has a non-empty description', () => {
    for (const rule of VALUE_CHAIN_RULES) {
      expect(rule.description.length).toBeGreaterThan(0)
    }
  })
})

describe('ECOSYSTEMS', () => {
  it('exposes 6 ecosystems', () => {
    expect(ECOSYSTEMS).toHaveLength(6)
  })

  it('every ecosystem has unique id', () => {
    const ids = ECOSYSTEMS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every ecosystem groups at least 3 CIIUs', () => {
    for (const eco of ECOSYSTEMS) {
      expect(eco.ciiuCodes.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('every ecosystem CIIU is 4-digit', () => {
    for (const eco of ECOSYSTEMS) {
      for (const code of eco.ciiuCodes) {
        expect(code).toMatch(/^\d{4}$/)
      }
    }
  })

  it('exposes the canonical 6 ecosystem ids', () => {
    expect(ECOSYSTEMS.map((e) => e.id).sort()).toEqual([
      'agro-exportador',
      'construccion',
      'educacion',
      'salud',
      'servicios-profesionales',
      'turismo',
    ])
  })
})

describe('findRulesForPair', () => {
  const fakeRules: ValueChainRule[] = [
    {
      ciiuOrigen: '0122',
      ciiuDestino: '4631',
      weight: 0.85,
      description: 'Banano hacia mayoristas',
    },
    {
      ciiuOrigen: '6910',
      ciiuDestino: '*',
      weight: 0.4,
      description: 'Legal universal',
    },
    {
      ciiuOrigen: '4923',
      ciiuDestino: '4290',
      weight: 0.85,
      description: 'Transporte para construcción',
    },
  ]

  it('matches a direct ciiu-ciiu pair', () => {
    const result = findRulesForPair('0122', '4631', fakeRules)
    expect(result).toHaveLength(1)
    expect(result[0].description).toMatch(/Banano/)
  })

  it('matches wildcard destino * for any target', () => {
    const result = findRulesForPair('6910', '4631', fakeRules)
    expect(result.map((r) => r.description)).toEqual(['Legal universal'])
  })

  it('returns empty when no rule applies', () => {
    expect(findRulesForPair('9999', '0000', fakeRules)).toEqual([])
  })

  it('falls back to the registry when rules omitted', () => {
    const result = findRulesForPair('0122', '4631')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('findEcosystemsContaining', () => {
  const fakeEcos: Ecosystem[] = [
    {
      id: 'a',
      name: 'A',
      ciiuCodes: ['0001', '0002'],
      description: 'a',
    },
    {
      id: 'b',
      name: 'B',
      ciiuCodes: ['0001', '0003'],
      description: 'b',
    },
    {
      id: 'c',
      name: 'C',
      ciiuCodes: ['0004'],
      description: 'c',
    },
  ]

  it('returns ecosystems that include the CIIU', () => {
    const result = findEcosystemsContaining('0001', fakeEcos)
    expect(result.map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('returns empty when no ecosystem contains the CIIU', () => {
    expect(findEcosystemsContaining('9999', fakeEcos)).toEqual([])
  })

  it('falls back to the registry when ecosystems omitted', () => {
    const result = findEcosystemsContaining('5511')
    expect(result.length).toBeGreaterThan(0)
    expect(result.some((e) => e.id === 'turismo')).toBe(true)
  })
})
