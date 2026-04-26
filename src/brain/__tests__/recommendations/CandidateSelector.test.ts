import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import {
  CandidateSelector,
  canonicalPair,
} from '@/recommendations/application/services/CandidateSelector'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c1',
    razonSocial: 'Acme',
    ciiu: 'G4631',
    municipio: 'SANTA MARTA',
    ...overrides,
  })

describe('canonicalPair', () => {
  it('orders ciius alphabetically to produce a symmetric key', () => {
    expect(canonicalPair('5611', '4631')).toBe('4631|5611')
    expect(canonicalPair('4631', '5611')).toBe('4631|5611')
  })

  it('returns same key when ciius are equal', () => {
    expect(canonicalPair('5611', '5611')).toBe('5611|5611')
  })
})

describe('CandidateSelector.selectCiiuPairs', () => {
  const selector = new CandidateSelector()

  it('produces auto-pairs for each distinct ciiu (referente)', () => {
    const companies = [
      company({ id: 'c1', ciiu: 'G4631' }),
      company({ id: 'c2', ciiu: 'I5611' }),
    ]
    const pairs = selector.selectCiiuPairs(companies)

    expect(pairs.has('4631|4631')).toBe(true)
    expect(pairs.has('5611|5611')).toBe(true)
  })

  it('pairs ciius from the same division', () => {
    const companies = [
      company({ id: 'c1', ciiu: 'I5611' }),
      company({ id: 'c2', ciiu: 'I5630' }),
    ]
    const pairs = selector.selectCiiuPairs(companies)

    expect(pairs.has(canonicalPair('5611', '5630'))).toBe(true)
  })

  it('pairs ciius linked through a value chain rule', () => {
    const companies = [
      company({ id: 'c1', ciiu: 'A0122' }),
      company({ id: 'c2', ciiu: 'G4631' }),
    ]
    const pairs = selector.selectCiiuPairs(companies)
    expect(pairs.has(canonicalPair('0122', '4631'))).toBe(true)
  })

  it('pairs ciius via wildcard rule (target = *)', () => {
    const companies = [
      company({ id: 'c1', ciiu: 'M6910' }),
      company({ id: 'c2', ciiu: 'P8512' }),
    ]
    const pairs = selector.selectCiiuPairs(companies)
    expect(pairs.has(canonicalPair('6910', '8512'))).toBe(true)
  })

  it('pairs ciius that share an ecosystem', () => {
    const companies = [
      company({ id: 'c1', ciiu: 'I5511' }),
      company({ id: 'c2', ciiu: 'L6810' }),
    ]
    const pairs = selector.selectCiiuPairs(companies)
    expect(pairs.has(canonicalPair('5511', '6810'))).toBe(true)
  })

  it('does not pair unrelated ciius from different divisions, no rules, no ecosystems', () => {
    const companies = [
      company({ id: 'c1', ciiu: 'A0122' }),
      company({ id: 'c2', ciiu: 'P8551' }),
    ]
    const pairs = selector.selectCiiuPairs(companies)
    expect(pairs.has(canonicalPair('0122', '8551'))).toBe(false)
  })

  it('deduplicates when many companies share the same ciiu', () => {
    const companies = [
      company({ id: 'c1', ciiu: 'G4631' }),
      company({ id: 'c2', ciiu: 'G4631' }),
      company({ id: 'c3', ciiu: 'G4631' }),
    ]
    const pairs = selector.selectCiiuPairs(companies)
    expect(pairs.size).toBe(1)
    expect(pairs.has('4631|4631')).toBe(true)
  })
})

describe('CandidateSelector.selectTargetCompanies', () => {
  const selector = new CandidateSelector()
  const source = company({
    id: 'src',
    ciiu: 'G4631',
    municipio: 'SANTA MARTA',
  })

  it('excludes the source company itself', () => {
    const cache = new Map([[canonicalPair('4631', '4631'), { hasMatch: true }]])
    const result = selector.selectTargetCompanies(source, [source], cache)
    expect(result).toEqual([])
  })

  it('keeps only companies with hasMatch=true in the cache', () => {
    const t1 = company({ id: 't1', ciiu: 'I5611', municipio: 'SANTA MARTA' })
    const t2 = company({ id: 't2', ciiu: 'P8551', municipio: 'BOGOTÁ' })
    const cache = new Map<string, { hasMatch: boolean }>([
      [canonicalPair('4631', '5611'), { hasMatch: true }],
      [canonicalPair('4631', '8551'), { hasMatch: false }],
    ])
    const result = selector.selectTargetCompanies(
      source,
      [source, t1, t2],
      cache,
    )
    expect(result.map((c) => c.id)).toEqual(['t1'])
  })

  it('sorts by proximity score (same municipio + same ciiuDivision gain priority)', () => {
    const near = company({
      id: 'near',
      ciiu: 'G4719',
      municipio: 'SANTA MARTA',
    })
    const far = company({
      id: 'far',
      ciiu: 'G4719',
      municipio: 'CARTAGENA',
    })
    const cache = new Map<string, { hasMatch: boolean }>([
      [canonicalPair('4631', '4719'), { hasMatch: true }],
    ])
    const result = selector.selectTargetCompanies(
      source,
      [source, far, near],
      cache,
    )
    expect(result.map((c) => c.id)).toEqual(['near', 'far'])
  })

  it('respects the topN parameter', () => {
    const targets = Array.from({ length: 5 }, (_, i) =>
      company({ id: `t${i}`, ciiu: 'I5611', municipio: 'SANTA MARTA' }),
    )
    const cache = new Map<string, { hasMatch: boolean }>([
      [canonicalPair('4631', '5611'), { hasMatch: true }],
    ])
    const result = selector.selectTargetCompanies(
      source,
      [source, ...targets],
      cache,
      2,
    )
    expect(result).toHaveLength(2)
  })

  it('uses the default topN of 30 when not specified', () => {
    const targets = Array.from({ length: 50 }, (_, i) =>
      company({ id: `t${i}`, ciiu: 'I5611', municipio: 'SANTA MARTA' }),
    )
    const cache = new Map<string, { hasMatch: boolean }>([
      [canonicalPair('4631', '5611'), { hasMatch: true }],
    ])
    const result = selector.selectTargetCompanies(
      source,
      [source, ...targets],
      cache,
    )
    expect(result).toHaveLength(30)
  })

  it('treats absent cache entries as no-match', () => {
    const t1 = company({ id: 't1', ciiu: 'I5611' })
    const cache = new Map<string, { hasMatch: boolean }>()
    const result = selector.selectTargetCompanies(source, [source, t1], cache)
    expect(result).toEqual([])
  })
})
