import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { DynamicValueChainRules } from '@/recommendations/application/services/DynamicValueChainRules'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c1',
    razonSocial: 'Acme',
    ciiu: 'G4631',
    municipio: 'SANTA MARTA',
    ...overrides,
  })

function makeEdge(
  ciiuOrigen: string,
  ciiuDestino: string,
  relationType: 'cliente' | 'proveedor',
  confidence = 0.8,
): CiiuEdge {
  return CiiuEdge.create({
    ciiuOrigen,
    ciiuDestino,
    hasMatch: true,
    relationType,
    confidence,
    modelVersion: null,
  })
}

function makeMatcher(
  edges: CiiuEdge[] = [],
  aiEnabled = false,
): ValueChainMatcher {
  const graph = new InMemoryCiiuGraphRepository()
  if (edges.length > 0) graph.seed(edges)
  const dynamicRules = new DynamicValueChainRules(graph)
  return new ValueChainMatcher(dynamicRules, aiEnabled)
}

describe('ValueChainMatcher', () => {
  it('produces cliente from origin and proveedor from target for matching pairs', async () => {
    const matcher = makeMatcher()
    const banano = company({ id: 'banano', ciiu: 'A0122' })
    const mayor = company({ id: 'mayor', ciiu: 'G4631' })
    const result = await matcher.match([banano, mayor])

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

  it('boosts the score when source and target are in the same municipio', async () => {
    const matcher = makeMatcher()
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
    const result = await matcher.match([banano, mayorSM, mayorBog])
    const recs = result.get('banano') ?? []
    const sameMunicipio = recs.find((r) => r.targetCompanyId === 'mayorSM')!
    const otherMunicipio = recs.find((r) => r.targetCompanyId === 'mayorBog')!
    expect(sameMunicipio.score).toBeGreaterThan(otherMunicipio.score)
  })

  it('expands wildcard rule (target=*) to every other ciiu', async () => {
    const matcher = makeMatcher()
    const legal = company({ id: 'legal', ciiu: 'M6910' })
    const a = company({ id: 'a', ciiu: 'P8512' })
    const b = company({ id: 'b', ciiu: 'A0121' })
    const result = await matcher.match([legal, a, b])
    const legalRecs = result.get('legal') ?? []
    const targets = legalRecs.map((r) => r.targetCompanyId)
    expect(targets).toContain('a')
    expect(targets).toContain('b')
  })

  it('does not generate a recommendation between a company and itself', async () => {
    const matcher = makeMatcher()
    const c1 = company({ id: 'c1', ciiu: 'G4631' })
    const c2 = company({ id: 'c2', ciiu: 'G4631' })
    const result = await matcher.match([c1, c2])

    const c1Recs = result.get('c1') ?? []
    expect(c1Recs.every((r) => r.targetCompanyId !== 'c1')).toBe(true)
  })

  it('attaches structured reasons with cadena_valor_directa for cliente and inversa for proveedor', async () => {
    const matcher = makeMatcher()
    const banano = company({ id: 'banano', ciiu: 'A0122' })
    const mayor = company({ id: 'mayor', ciiu: 'G4631' })
    const result = await matcher.match([banano, mayor])

    const bananoRec = result.get('banano')![0]
    const mayorRec = result.get('mayor')![0]
    expect(bananoRec.reasons.toJson()[0].feature).toBe('cadena_valor_directa')
    expect(mayorRec.reasons.toJson()[0].feature).toBe('cadena_valor_inversa')
  })

  it('returns no recommendations when no rule applies', async () => {
    const matcher = makeMatcher()
    const a = company({ id: 'a', ciiu: 'P8512' })
    const b = company({ id: 'b', ciiu: 'P8551' })
    const result = await matcher.match([a, b])
    expect(result.get('a') ?? []).toEqual([])
    expect(result.get('b') ?? []).toEqual([])
  })

  it('produces unique recommendation ids', async () => {
    const matcher = makeMatcher()
    const banano = company({ id: 'banano', ciiu: 'A0122' })
    const mayor1 = company({ id: 'm1', ciiu: 'G4631' })
    const mayor2 = company({ id: 'm2', ciiu: 'G4631' })
    const result = await matcher.match([banano, mayor1, mayor2])
    const recs = result.get('banano') ?? []
    const ids = recs.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  describe('flag=false behavior', () => {
    it('with flag=false (graph is empty): output identical to hardcoded rules only', async () => {
      // flag=false → DynamicValueChainRules returns VALUE_CHAIN_RULES literal
      const matcher = makeMatcher()
      const banano = company({ id: 'banano', ciiu: 'A0122' })
      const mayor = company({ id: 'mayor', ciiu: 'G4631' })
      const result = await matcher.match([banano, mayor])

      // Expect the same result as the hardcoded rules
      // rule: 0122→4631 weight=0.85, same municipio → factor=1 → score=min(1, 0.85*1)=0.85
      const bananoRecs = result.get('banano') ?? []
      expect(bananoRecs).toHaveLength(1)
      expect(bananoRecs[0].relationType).toBe('cliente')
      expect(bananoRecs[0].score).toBe(0.85) // weight 0.85 * factor 1 (same municipio)
    })
  })

  describe('flag=true behavior', () => {
    it('flag=true + empty graph → falls back to hardcoded, no error', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      const dynamicRules = new DynamicValueChainRules(graph)
      const matcher = new ValueChainMatcher(dynamicRules, true)

      const banano = company({ id: 'banano', ciiu: 'A0122' })
      const mayor = company({ id: 'mayor', ciiu: 'G4631' })

      const result = await matcher.match([banano, mayor])
      expect(result.get('banano') ?? []).toHaveLength(1)
    })

    it('flag=true + graph with dynamic edge → dynamic rule generates recommendation for new pair (via helper)', async () => {
      // Seed a graph with edges in CIIU codes from VALUE_CHAIN_RULES
      // 0122→4631 is in VALUE_CHAIN_RULES with weight 0.85 — the dynamic graph overrides it with 0.9
      // 4631→5611 is in VALUE_CHAIN_RULES but NOT in the graph → fallback to hardcoded
      const graph = new InMemoryCiiuGraphRepository()
      graph.seed([makeEdge('0122', '4631', 'cliente', 0.9)])
      const dynamicRules = new DynamicValueChainRules(graph)

      // Test with helper directly (flag=true)
      const rules = await dynamicRules.getValueChainRules(true)
      const dynamicRule = rules.find(
        (r) => r.ciiuOrigen === '0122' && r.ciiuDestino === '4631',
      )
      expect(dynamicRule).toBeDefined()
      expect(dynamicRule!.weight).toBe(0.9) // dynamic weight overrides hardcoded 0.85

      // Hardcoded rules for other pairs still present (4631→5611 not in graph)
      const hardcoded = rules.find(
        (r) => r.ciiuOrigen === '4631' && r.ciiuDestino === '5611',
      )
      expect(hardcoded).toBeDefined()
      expect(hardcoded!.weight).toBe(0.85) // original hardcoded weight preserved

      // Only one rule for 0122→4631 (dynamic replaces hardcoded, no duplicate)
      const pairs = rules.filter(
        (r) => r.ciiuOrigen === '0122' && r.ciiuDestino === '4631',
      )
      expect(pairs).toHaveLength(1)
    })
  })

  describe('regression: flag=false output identical to pre-change baseline', () => {
    it('same score for banano→mayor pair as before refactor', async () => {
      const matcher = makeMatcher()
      const banano = company({
        id: 'banano',
        ciiu: 'A0122',
        municipio: 'SANTA MARTA',
      })
      const mayor = company({
        id: 'mayor',
        ciiu: 'G4631',
        municipio: 'SANTA MARTA',
      })
      const result = await matcher.match([banano, mayor])

      // Before refactor: score = min(1, 0.85 * 1) = 0.85 (same municipio boost = 1)
      const bananoRec = result.get('banano')![0]
      expect(bananoRec.score).toBe(0.85)
      expect(bananoRec.relationType).toBe('cliente')
    })
  })
})
