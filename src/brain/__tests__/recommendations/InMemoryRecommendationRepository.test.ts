import { beforeEach, describe, expect, it } from 'vitest'
import {
  Recommendation,
  type CreateRecommendationInput,
} from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'

const makeRec = (
  overrides: Partial<CreateRecommendationInput> = {},
): Recommendation =>
  Recommendation.create({
    id: 'rec-1',
    sourceCompanyId: 'a',
    targetCompanyId: 'b',
    relationType: 'cliente',
    score: 0.5,
    reasons: Reasons.empty(),
    source: 'rule',
    ...overrides,
  })

describe('InMemoryRecommendationRepository', () => {
  let repo: InMemoryRecommendationRepository

  beforeEach(() => {
    repo = new InMemoryRecommendationRepository()
  })

  it('saveAll persists every recommendation', async () => {
    await repo.saveAll([
      makeRec({ id: 'r1' }),
      makeRec({ id: 'r2', targetCompanyId: 'c' }),
    ])

    expect(await repo.findById('r1')).not.toBeNull()
    expect(await repo.findById('r2')).not.toBeNull()
  })

  it('saveAll upserts by id', async () => {
    await repo.saveAll([makeRec({ id: 'r1', score: 0.1 })])
    await repo.saveAll([makeRec({ id: 'r1', score: 0.9 })])

    const fetched = await repo.findById('r1')
    expect(fetched!.score).toBe(0.9)
    expect(await repo.countBySource('a')).toBe(1)
  })

  it('findById returns null for unknown id', async () => {
    expect(await repo.findById('missing')).toBeNull()
  })

  it('findBySource returns all recs sourced from a company sorted by score desc', async () => {
    await repo.saveAll([
      makeRec({ id: 'r1', sourceCompanyId: 'a', score: 0.4 }),
      makeRec({
        id: 'r2',
        sourceCompanyId: 'a',
        targetCompanyId: 'c',
        score: 0.9,
      }),
      makeRec({
        id: 'r3',
        sourceCompanyId: 'a',
        targetCompanyId: 'd',
        score: 0.7,
      }),
      makeRec({ id: 'r4', sourceCompanyId: 'other', targetCompanyId: 'b' }),
    ])

    const result = await repo.findBySource('a')
    expect(result.map((r) => r.id)).toEqual(['r2', 'r3', 'r1'])
  })

  it('findBySource respects the limit parameter', async () => {
    await repo.saveAll([
      makeRec({ id: 'r1', score: 0.9 }),
      makeRec({ id: 'r2', targetCompanyId: 'c', score: 0.7 }),
      makeRec({ id: 'r3', targetCompanyId: 'd', score: 0.5 }),
    ])

    expect(await repo.findBySource('a', 2)).toHaveLength(2)
  })

  it('findBySourceAndType filters by relation type', async () => {
    await repo.saveAll([
      makeRec({ id: 'r1', relationType: 'cliente', score: 0.9 }),
      makeRec({
        id: 'r2',
        relationType: 'proveedor',
        targetCompanyId: 'c',
        score: 0.8,
      }),
      makeRec({
        id: 'r3',
        relationType: 'cliente',
        targetCompanyId: 'd',
        score: 0.6,
      }),
    ])

    const clientes = await repo.findBySourceAndType('a', 'cliente')
    expect(clientes.map((r) => r.id)).toEqual(['r1', 'r3'])
  })

  it('findBySourceAndType respects the limit', async () => {
    await repo.saveAll([
      makeRec({ id: 'r1', relationType: 'cliente', score: 0.9 }),
      makeRec({
        id: 'r2',
        relationType: 'cliente',
        targetCompanyId: 'c',
        score: 0.8,
      }),
      makeRec({
        id: 'r3',
        relationType: 'cliente',
        targetCompanyId: 'd',
        score: 0.7,
      }),
    ])

    expect(await repo.findBySourceAndType('a', 'cliente', 2)).toHaveLength(2)
  })

  it('updateExplanation mutates only the explanation and stamps cached_at', async () => {
    await repo.saveAll([makeRec({ id: 'r1' })])
    await repo.updateExplanation('r1', 'porque sí')

    const fetched = await repo.findById('r1')
    expect(fetched!.explanation).toBe('porque sí')
    expect(fetched!.explanationCachedAt).toBeInstanceOf(Date)
  })

  it('updateExplanation is a no-op for unknown id', async () => {
    await expect(
      repo.updateExplanation('missing', 'x'),
    ).resolves.toBeUndefined()
  })

  it('countBySource counts only the matching source', async () => {
    await repo.saveAll([
      makeRec({ id: 'r1', sourceCompanyId: 'a' }),
      makeRec({ id: 'r2', sourceCompanyId: 'a', targetCompanyId: 'c' }),
      makeRec({ id: 'r3', sourceCompanyId: 'other', targetCompanyId: 'b' }),
    ])

    expect(await repo.countBySource('a')).toBe(2)
    expect(await repo.countBySource('other')).toBe(1)
    expect(await repo.countBySource('nope')).toBe(0)
  })

  it('deleteAll empties the store', async () => {
    await repo.saveAll([makeRec({ id: 'r1' })])
    await repo.deleteAll()

    expect(await repo.findById('r1')).toBeNull()
    expect(await repo.countBySource('a')).toBe(0)
  })

  describe('findAll', () => {
    it('returns every stored recommendation', async () => {
      await repo.saveAll([
        makeRec({ id: 'r1' }),
        makeRec({ id: 'r2', sourceCompanyId: 'x', targetCompanyId: 'y' }),
        makeRec({ id: 'r3', targetCompanyId: 'c', relationType: 'proveedor' }),
      ])

      const all = await repo.findAll()
      expect(all).toHaveLength(3)
      expect(all.map((r) => r.id).sort()).toEqual(['r1', 'r2', 'r3'])
    })

    it('returns empty array when store is empty', async () => {
      expect(await repo.findAll()).toEqual([])
    })
  })

  describe('snapshotKeys', () => {
    it('returns a Set of source|target|type keys for every stored rec', async () => {
      await repo.saveAll([
        makeRec({
          id: 'r1',
          sourceCompanyId: 'a',
          targetCompanyId: 'b',
          relationType: 'cliente',
        }),
        makeRec({
          id: 'r2',
          sourceCompanyId: 'a',
          targetCompanyId: 'b',
          relationType: 'proveedor',
        }),
        makeRec({
          id: 'r3',
          sourceCompanyId: 'x',
          targetCompanyId: 'y',
          relationType: 'aliado',
        }),
      ])

      const keys = await repo.snapshotKeys()
      expect(keys).toBeInstanceOf(Set)
      expect(keys.size).toBe(3)
      expect(keys.has('a|b|cliente')).toBe(true)
      expect(keys.has('a|b|proveedor')).toBe(true)
      expect(keys.has('x|y|aliado')).toBe(true)
    })

    it('returns an empty Set when store is empty', async () => {
      const keys = await repo.snapshotKeys()
      expect(keys.size).toBe(0)
    })

    it('does not include score in the key (different scores collapse)', async () => {
      await repo.saveAll([
        makeRec({
          id: 'r1',
          sourceCompanyId: 'a',
          targetCompanyId: 'b',
          relationType: 'cliente',
          score: 0.3,
        }),
        makeRec({
          id: 'r2',
          sourceCompanyId: 'a',
          targetCompanyId: 'b',
          relationType: 'cliente',
          score: 0.9,
        }),
      ])

      const keys = await repo.snapshotKeys()
      expect(keys.size).toBe(1)
      expect(keys.has('a|b|cliente')).toBe(true)
    })
  })
})
