import { beforeEach, describe, expect, it } from 'vitest'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'

function makeEdge(
  ciiuOrigen: string,
  ciiuDestino: string,
  overrides: Partial<{
    hasMatch: boolean
    relationType: 'cliente' | 'proveedor' | 'aliado' | 'referente' | null
    confidence: number
    modelVersion: string | null
  }> = {},
): CiiuEdge {
  const hasMatch = overrides.hasMatch ?? true
  return CiiuEdge.create({
    ciiuOrigen,
    ciiuDestino,
    hasMatch,
    relationType: hasMatch ? (overrides.relationType ?? 'proveedor') : null,
    confidence: overrides.confidence ?? 0.8,
    modelVersion: overrides.modelVersion ?? null,
  })
}

describe('InMemoryCiiuGraphRepository', () => {
  let repo: InMemoryCiiuGraphRepository

  beforeEach(() => {
    repo = new InMemoryCiiuGraphRepository()
  })

  it('returns empty arrays when constructed without edges', async () => {
    expect(await repo.getMatchingPairs(0.5)).toEqual([])
    expect(await repo.getEdgesByOrigin('5511', 0.5)).toEqual([])
  })

  it('seed() populates the repository', async () => {
    repo.seed([makeEdge('A', 'B'), makeEdge('C', 'D')])
    const pairs = await repo.getMatchingPairs(0)
    expect(pairs).toHaveLength(2)
  })

  describe('getMatchingPairs', () => {
    beforeEach(() => {
      repo.seed([
        makeEdge('5511', '9601', {
          confidence: 0.9,
          relationType: 'proveedor',
        }),
        makeEdge('5511', '4711', { confidence: 0.5, relationType: 'cliente' }),
        makeEdge('0122', '4631', { confidence: 0.7, relationType: 'aliado' }),
        makeEdge('A', '*', { confidence: 0.9, relationType: 'proveedor' }), // wildcard
        makeEdge('X', 'Y', {
          hasMatch: false,
          confidence: 0.9,
          relationType: null,
        }), // hasMatch=false
      ])
    })

    it('filters by confidence threshold (inclusive)', async () => {
      const pairs = await repo.getMatchingPairs(0.7)
      const destinos = pairs.map((e) => e.ciiuDestino).sort()
      expect(destinos).toEqual(['4631', '9601'])
    })

    it('filters by relationType when specified', async () => {
      const pairs = await repo.getMatchingPairs(0, ['proveedor'])
      expect(pairs.map((e) => e.ciiuDestino)).toEqual(['9601'])
    })

    it('filters by multiple relationTypes', async () => {
      const pairs = await repo.getMatchingPairs(0, ['proveedor', 'cliente'])
      const destinos = pairs.map((e) => e.ciiuDestino).sort()
      expect(destinos).toEqual(['4711', '9601'])
    })

    it('returns all relation types when relationTypes not provided', async () => {
      const pairs = await repo.getMatchingPairs(0)
      // excludes wildcard and hasMatch=false
      expect(pairs).toHaveLength(3)
    })

    it('excludes wildcards (ciiuDestino === "*")', async () => {
      const pairs = await repo.getMatchingPairs(0)
      expect(pairs.every((e) => e.ciiuDestino !== '*')).toBe(true)
    })

    it('excludes edges with hasMatch=false', async () => {
      const pairs = await repo.getMatchingPairs(0)
      expect(pairs.every((e) => e.hasMatch)).toBe(true)
    })
  })

  describe('getEdgesByOrigin', () => {
    beforeEach(() => {
      repo.seed([
        makeEdge('5511', '9601', { confidence: 0.9 }),
        makeEdge('5511', '4711', { confidence: 0.5 }),
        makeEdge('0122', '4631', { confidence: 0.7 }),
        makeEdge('5511', '*', { confidence: 0.9 }), // wildcard excluded
      ])
    })

    it('filters by ciiuOrigen', async () => {
      const edges = await repo.getEdgesByOrigin('5511', 0)
      expect(edges.map((e) => e.ciiuDestino).sort()).toEqual(['4711', '9601'])
    })

    it('filters by confidence threshold', async () => {
      const edges = await repo.getEdgesByOrigin('5511', 0.7)
      expect(edges.map((e) => e.ciiuDestino)).toEqual(['9601'])
    })

    it('excludes wildcards', async () => {
      const edges = await repo.getEdgesByOrigin('5511', 0)
      expect(edges.every((e) => e.ciiuDestino !== '*')).toBe(true)
    })

    it('returns empty when origin has no edges', async () => {
      expect(await repo.getEdgesByOrigin('ZZZZ', 0)).toEqual([])
    })
  })
})
