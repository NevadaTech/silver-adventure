import { describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { DynamicValueChainRules } from '@/recommendations/application/services/DynamicValueChainRules'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'
import { ECOSYSTEMS } from '@/recommendations/application/services/ValueChainRules'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c1',
    razonSocial: 'Acme',
    ciiu: 'I5511',
    municipio: 'SANTA MARTA',
    ...overrides,
  })

function makeEdge(
  ciiuOrigen: string,
  ciiuDestino: string,
  relationType: 'aliado' | 'cliente' | 'proveedor',
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

function makeMatcher(edges: CiiuEdge[] = []): AllianceMatcher {
  const graph = new InMemoryCiiuGraphRepository()
  if (edges.length > 0) graph.seed(edges)
  const dynamicRules = new DynamicValueChainRules(graph)
  return new AllianceMatcher(dynamicRules)
}

describe('AllianceMatcher', () => {
  it('pairs companies that share an ecosystem with relationType aliado from ecosystem source', async () => {
    const matcher = makeMatcher()
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const transporte = company({ id: 'tr', ciiu: 'H4921' })
    const result = await matcher.match([hotel, transporte])

    const hotelRecs = result.get('hotel') ?? []
    expect(hotelRecs.length).toBeGreaterThan(0)
    expect(hotelRecs[0].relationType).toBe('aliado')
    expect(hotelRecs[0].source).toBe('ecosystem')
    expect(hotelRecs[0].targetCompanyId).toBe('tr')
  })

  it('does not pair companies of the same ciiu (would be referente, not aliado)', async () => {
    const matcher = makeMatcher()
    const hotel1 = company({ id: 'h1', ciiu: 'I5511' })
    const hotel2 = company({ id: 'h2', ciiu: 'I5511' })
    const result = await matcher.match([hotel1, hotel2])

    expect(result.get('h1') ?? []).toEqual([])
  })

  it('boosts score when companies share municipio', async () => {
    const matcher = makeMatcher()
    const hotel = company({
      id: 'hotel',
      ciiu: 'I5511',
      municipio: 'SANTA MARTA',
    })
    const trSm = company({
      id: 'trSm',
      ciiu: 'H4921',
      municipio: 'SANTA MARTA',
    })
    const trBog = company({ id: 'trBog', ciiu: 'H4921', municipio: 'BOGOTA' })

    const result = await matcher.match([hotel, trSm, trBog])
    const recs = result.get('hotel') ?? []
    const sm = recs.find((r) => r.targetCompanyId === 'trSm')!
    const bog = recs.find((r) => r.targetCompanyId === 'trBog')!
    expect(sm.score).toBeGreaterThan(bog.score)
  })

  it('attaches an ecosistema_compartido reason carrying the ecosystem id', async () => {
    const matcher = makeMatcher()
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const transporte = company({ id: 'tr', ciiu: 'H4921' })
    const result = await matcher.match([hotel, transporte])

    const reasons = result.get('hotel')![0].reasons.toJson()
    expect(reasons[0].feature).toBe('ecosistema_compartido')
    expect(reasons[0].value).toBe('turismo')
  })

  it('emits both directions of the alliance', async () => {
    const matcher = makeMatcher()
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const transporte = company({ id: 'tr', ciiu: 'H4921' })
    const result = await matcher.match([hotel, transporte])

    const hotelTargets = (result.get('hotel') ?? []).map(
      (r) => r.targetCompanyId,
    )
    const trTargets = (result.get('tr') ?? []).map((r) => r.targetCompanyId)
    expect(hotelTargets).toContain('tr')
    expect(trTargets).toContain('hotel')
  })

  it('returns no recommendations when no two companies share an ecosystem', async () => {
    const matcher = makeMatcher()
    const a = company({ id: 'a', ciiu: 'P8512' })
    const b = company({ id: 'b', ciiu: 'A0122' })
    const result = await matcher.match([a, b])
    expect(result.get('a') ?? []).toEqual([])
    expect(result.get('b') ?? []).toEqual([])
  })

  it('produces unique recommendation ids', async () => {
    const matcher = makeMatcher()
    const hotel = company({ id: 'hotel', ciiu: 'I5511' })
    const tr = company({ id: 'tr', ciiu: 'H4921' })
    const rest = company({ id: 'rest', ciiu: 'I5611' })
    const result = await matcher.match([hotel, tr, rest])
    const ids = (result.get('hotel') ?? []).map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  describe('flag=false behavior', () => {
    it('with flag=false (empty graph): same output as pre-change hardcoded rules', async () => {
      const matcher = makeMatcher()
      const hotel = company({ id: 'hotel', ciiu: 'I5511' })
      const transporte = company({ id: 'tr', ciiu: 'H4921' })
      const result = await matcher.match([hotel, transporte])

      // Should produce recommendation based on 'turismo' ecosystem (hardcoded)
      const recs = result.get('hotel') ?? []
      expect(recs.length).toBeGreaterThan(0)
      expect(recs[0].relationType).toBe('aliado')
      expect(recs[0].score).toBe(0.75) // same municipio → SAME_MUNICIPIO_SCORE
    })
  })

  describe('flag=true behavior', () => {
    it('flag=true + no aliado edges in graph → fallback to hardcoded ecosystems', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      // Only proveedor edges — no aliado
      graph.seed([makeEdge('I5511', 'H4921', 'cliente', 0.8)])
      const dynamicRules = new DynamicValueChainRules(graph)
      const matcher = new AllianceMatcher(dynamicRules)

      // getEcosystems(true) with no aliado → returns ECOSYSTEMS
      const ecosystems = await dynamicRules.getEcosystems(true)
      expect(ecosystems).toEqual(ECOSYSTEMS)

      // Matcher still works correctly
      const hotel = company({ id: 'hotel', ciiu: 'I5511' })
      const tr = company({ id: 'tr', ciiu: 'H4921' })
      const result = await matcher.match([hotel, tr])
      expect(result.get('hotel') ?? []).toHaveLength(1) // still from hardcoded
    })

    it('flag=true + aliado edges → dynamic ecosystems included, hardcoded still present', async () => {
      const graph = new InMemoryCiiuGraphRepository()
      // Use CIIU codes not in any hardcoded ecosystem
      graph.seed([makeEdge('Z9999', 'Z8888', 'aliado', 0.8)])
      const dynamicRules = new DynamicValueChainRules(graph)

      const ecosystems = await dynamicRules.getEcosystems(true)

      // Dynamic ecosystem added
      const dynamicEco = ecosystems.find((e) => e.ciiuCodes.includes('Z9999'))
      expect(dynamicEco).toBeDefined()

      // All hardcoded ecosystems still present
      for (const hardcoded of ECOSYSTEMS) {
        expect(ecosystems.find((e) => e.id === hardcoded.id)).toBeDefined()
      }
    })
  })

  describe('regression: flag=false output identical to pre-change baseline', () => {
    it('same score for hotel↔transporte pair as before refactor', async () => {
      const matcher = makeMatcher()
      const hotel = company({
        id: 'hotel',
        ciiu: 'I5511',
        municipio: 'SANTA MARTA',
      })
      const transporte = company({
        id: 'tr',
        ciiu: 'H4921',
        municipio: 'SANTA MARTA',
      })
      const result = await matcher.match([hotel, transporte])

      const recs = result.get('hotel') ?? []
      expect(recs.length).toBeGreaterThan(0)
      expect(recs[0].score).toBe(0.75) // SAME_MUNICIPIO_SCORE pre-change
      expect(recs[0].relationType).toBe('aliado')
    })
  })
})
