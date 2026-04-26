import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c1',
    razonSocial: 'Acme',
    ciiu: 'G4631',
    municipio: 'SANTA MARTA',
    ...overrides,
  })

describe('ValueChainMatcher', () => {
  const matcher = new ValueChainMatcher()

  it('produces cliente from origin and proveedor from target for matching pairs', () => {
    const banano = company({ id: 'banano', ciiu: 'A0122' })
    const mayor = company({ id: 'mayor', ciiu: 'G4631' })
    const result = matcher.match([banano, mayor])

    const bananoRecs = result.get('banano') ?? []
    const mayorRecs = result.get('mayor') ?? []

    expect(bananoRecs).toHaveLength(1)
    expect(bananoRecs[0].relationType).toBe('cliente')
    expect(bananoRecs[0].targetCompanyId).toBe('mayor')
    expect(bananoRecs[0].source).toBe('rule')

    expect(mayorRecs).toHaveLength(1)
    expect(mayorRecs[0].relationType).toBe('proveedor')
    expect(mayorRecs[0].targetCompanyId).toBe('banano')
  })

  it('boosts the score when source and target are in the same municipio', () => {
    const banano = company({
      id: 'banano',
      ciiu: 'A0122',
      municipio: 'SANTA MARTA',
    })
    const mayorSM = company({
      id: 'mayorSM',
      ciiu: 'G4631',
      municipio: 'SANTA MARTA',
    })
    const mayorBog = company({
      id: 'mayorBog',
      ciiu: 'G4631',
      municipio: 'BOGOTA',
    })
    const result = matcher.match([banano, mayorSM, mayorBog])
    const recs = result.get('banano') ?? []
    const sameMunicipio = recs.find((r) => r.targetCompanyId === 'mayorSM')!
    const otherMunicipio = recs.find((r) => r.targetCompanyId === 'mayorBog')!
    expect(sameMunicipio.score).toBeGreaterThan(otherMunicipio.score)
  })

  it('expands wildcard rule (target=*) to every other ciiu', () => {
    const legal = company({ id: 'legal', ciiu: 'M6910' })
    const a = company({ id: 'a', ciiu: 'P8512' })
    const b = company({ id: 'b', ciiu: 'A0121' })
    const result = matcher.match([legal, a, b])
    const legalRecs = result.get('legal') ?? []
    const targets = legalRecs.map((r) => r.targetCompanyId)
    expect(targets).toContain('a')
    expect(targets).toContain('b')
  })

  it('does not generate a recommendation between a company and itself', () => {
    const c1 = company({ id: 'c1', ciiu: 'G4631' })
    const c2 = company({ id: 'c2', ciiu: 'G4631' })
    const result = matcher.match([c1, c2])

    const c1Recs = result.get('c1') ?? []
    expect(c1Recs.every((r) => r.targetCompanyId !== 'c1')).toBe(true)
  })

  it('attaches structured reasons with cadena_valor_directa for cliente and inversa for proveedor', () => {
    const banano = company({ id: 'banano', ciiu: 'A0122' })
    const mayor = company({ id: 'mayor', ciiu: 'G4631' })
    const result = matcher.match([banano, mayor])

    const bananoRec = result.get('banano')![0]
    const mayorRec = result.get('mayor')![0]
    expect(bananoRec.reasons.toJson()[0].feature).toBe('cadena_valor_directa')
    expect(mayorRec.reasons.toJson()[0].feature).toBe('cadena_valor_inversa')
  })

  it('returns no recommendations when no rule applies', () => {
    const a = company({ id: 'a', ciiu: 'P8512' })
    const b = company({ id: 'b', ciiu: 'P8551' })
    const result = matcher.match([a, b])
    expect(result.get('a') ?? []).toEqual([])
    expect(result.get('b') ?? []).toEqual([])
  })

  it('produces unique recommendation ids', () => {
    const banano = company({ id: 'banano', ciiu: 'A0122' })
    const mayor1 = company({ id: 'm1', ciiu: 'G4631' })
    const mayor2 = company({ id: 'm2', ciiu: 'G4631' })
    const result = matcher.match([banano, mayor1, mayor2])
    const recs = result.get('banano') ?? []
    const ids = recs.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
