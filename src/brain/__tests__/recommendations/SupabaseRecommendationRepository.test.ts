import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { SupabaseRecommendationRepository } from '@/recommendations/infrastructure/repositories/SupabaseRecommendationRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of [
    'from',
    'select',
    'eq',
    'in',
    'update',
    'upsert',
    'delete',
    'neq',
    'order',
    'limit',
  ] as const) {
    builder[fn].mockReturnValue(builder)
  }
  builder.maybeSingle.mockImplementation(() => Promise.resolve(resolved))

  return {
    db: builder as unknown as BrainSupabaseClient,
    setNext: (value: Resolved) => {
      resolved = value
    },
    spies: builder,
  }
}

const validRow = {
  id: 'rec-1',
  source_company_id: 'a',
  target_company_id: 'b',
  relation_type: 'cliente',
  score: 0.8,
  reasons: [
    { feature: 'mismo_ciiu_clase', weight: 0.4, description: 'mismo ciiu' },
  ],
  source: 'ai-inferred',
  explanation: null,
  explanation_cached_at: null,
}

describe('SupabaseRecommendationRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseRecommendationRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseRecommendationRepository(fake.db)
  })

  describe('saveAll', () => {
    it('upserts every recommendation row', async () => {
      const rec = Recommendation.create({
        id: 'rec-1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'cliente',
        score: 0.8,
        reasons: Reasons.from([
          {
            feature: 'mismo_ciiu_clase',
            weight: 0.4,
            description: 'mismo ciiu',
          },
        ]),
        source: 'ai-inferred',
      })

      fake.setNext({ data: null, error: null })
      await repo.saveAll([rec])

      expect(fake.spies.from).toHaveBeenCalledWith('recommendations')
      expect(fake.spies.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'rec-1',
            source_company_id: 'a',
            target_company_id: 'b',
            relation_type: 'cliente',
            score: 0.8,
            source: 'ai-inferred',
          }),
        ]),
        { onConflict: 'id' },
      )
    })

    it('is a no-op when array is empty', async () => {
      await repo.saveAll([])
      expect(fake.spies.upsert).not.toHaveBeenCalled()
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      const rec = Recommendation.create({
        id: 'rec-1',
        sourceCompanyId: 'a',
        targetCompanyId: 'b',
        relationType: 'cliente',
        score: 0.8,
        reasons: Reasons.empty(),
        source: 'rule',
      })
      await expect(repo.saveAll([rec])).rejects.toThrow(/boom/)
    })
  })

  describe('findById', () => {
    it('returns mapped entity when row exists', async () => {
      fake.setNext({ data: validRow, error: null })
      const rec = await repo.findById('rec-1')
      expect(rec).toBeInstanceOf(Recommendation)
      expect(rec!.id).toBe('rec-1')
      expect(rec!.relationType).toBe('cliente')
      expect(rec!.reasons.toJson()).toHaveLength(1)
    })

    it('returns null when row missing', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findById('x')).toBeNull()
    })
  })

  describe('findBySource', () => {
    it('orders by score desc and applies limit when provided', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.findBySource('a', 5)

      expect(fake.spies.eq).toHaveBeenCalledWith('source_company_id', 'a')
      expect(fake.spies.order).toHaveBeenCalledWith('score', {
        ascending: false,
      })
      expect(fake.spies.limit).toHaveBeenCalledWith(5)
    })

    it('does not call limit when omitted', async () => {
      fake.setNext({ data: [], error: null })
      await repo.findBySource('a')
      expect(fake.spies.limit).not.toHaveBeenCalled()
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.findBySource('a')).rejects.toThrow(/boom/)
    })

    it('throws when row source is unknown', async () => {
      fake.setNext({
        data: [{ ...validRow, source: 'wat' }],
        error: null,
      })
      await expect(repo.findBySource('a')).rejects.toThrow(
        /Unknown recommendation source/,
      )
    })

    it('throws when row relation_type is unknown', async () => {
      fake.setNext({
        data: [{ ...validRow, relation_type: 'wat' }],
        error: null,
      })
      await expect(repo.findBySource('a')).rejects.toThrow(
        /Unknown recommendation relation_type/,
      )
    })
  })

  describe('findBySourceAndType', () => {
    it('filters by source and type with ordering', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.findBySourceAndType('a', 'cliente', 3)

      expect(fake.spies.eq).toHaveBeenCalledWith('source_company_id', 'a')
      expect(fake.spies.eq).toHaveBeenCalledWith('relation_type', 'cliente')
      expect(fake.spies.order).toHaveBeenCalledWith('score', {
        ascending: false,
      })
      expect(fake.spies.limit).toHaveBeenCalledWith(3)
    })
  })

  describe('updateExplanation', () => {
    it('updates explanation and stamps explanation_cached_at', async () => {
      fake.setNext({ data: null, error: null })
      await repo.updateExplanation('rec-1', 'porque sí')

      expect(fake.spies.update).toHaveBeenCalledWith(
        expect.objectContaining({
          explanation: 'porque sí',
          explanation_cached_at: expect.any(String),
        }),
      )
      expect(fake.spies.eq).toHaveBeenCalledWith('id', 'rec-1')
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.updateExplanation('rec-1', 'x')).rejects.toThrow(/boom/)
    })
  })

  describe('countBySource', () => {
    it('uses count: exact head: true and filters by source', async () => {
      fake.setNext({ data: null, error: null, count: 12 })
      const n = await repo.countBySource('a')
      expect(n).toBe(12)
      expect(fake.spies.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      })
      expect(fake.spies.eq).toHaveBeenCalledWith('source_company_id', 'a')
    })

    it('returns 0 when count is null', async () => {
      fake.setNext({ data: null, error: null, count: null })
      expect(await repo.countBySource('a')).toBe(0)
    })
  })

  describe('deleteAll', () => {
    it('issues a delete with neq trick to remove all rows', async () => {
      fake.setNext({ data: null, error: null })
      await repo.deleteAll()
      expect(fake.spies.delete).toHaveBeenCalled()
      expect(fake.spies.neq).toHaveBeenCalledWith('id', '')
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.deleteAll()).rejects.toThrow(/boom/)
    })
  })
})
