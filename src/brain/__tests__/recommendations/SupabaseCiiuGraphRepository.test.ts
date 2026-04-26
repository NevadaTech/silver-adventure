import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { SupabaseCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/SupabaseCiiuGraphRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of ['from', 'select', 'eq', 'gte', 'neq', 'in'] as const) {
    builder[fn].mockReturnValue(builder)
  }

  return {
    db: builder as unknown as BrainSupabaseClient,
    setNext: (value: Resolved) => {
      resolved = value
    },
    spies: builder,
  }
}

const validRow = {
  ciiu_origen: '5511',
  ciiu_destino: '9601',
  has_match: true,
  relation_type: 'proveedor',
  confidence: 0.85,
  model_version: 'gemini-2.5-flash',
}

describe('SupabaseCiiuGraphRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseCiiuGraphRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseCiiuGraphRepository(fake.db)
  })

  describe('getMatchingPairs', () => {
    it('queries with eq(has_match, true), gte(confidence, threshold), neq(ciiu_destino, *)', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.getMatchingPairs(0.65)

      expect(fake.spies.from).toHaveBeenCalledWith('ai_match_cache')
      expect(fake.spies.eq).toHaveBeenCalledWith('has_match', true)
      expect(fake.spies.gte).toHaveBeenCalledWith('confidence', 0.65)
      expect(fake.spies.neq).toHaveBeenCalledWith('ciiu_destino', '*')
      expect(result).toHaveLength(1)
      expect(result[0]).toBeInstanceOf(CiiuEdge)
      expect(result[0].ciiuOrigen).toBe('5511')
      expect(result[0].ciiuDestino).toBe('9601')
      expect(result[0].confidence).toBe(0.85)
      expect(result[0].modelVersion).toBe('gemini-2.5-flash')
    })

    it('adds .in(relation_type, ...) when relationTypes are specified', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.getMatchingPairs(0.65, ['proveedor', 'cliente'])
      expect(fake.spies.in).toHaveBeenCalledWith('relation_type', [
        'proveedor',
        'cliente',
      ])
    })

    it('does NOT add .in() when relationTypes is empty', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.getMatchingPairs(0.65, [])
      expect(fake.spies.in).not.toHaveBeenCalled()
    })

    it('does NOT add .in() when relationTypes is undefined', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.getMatchingPairs(0.65)
      expect(fake.spies.in).not.toHaveBeenCalled()
    })

    it('returns empty array when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.getMatchingPairs(0.65)).toEqual([])
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('db boom') })
      await expect(repo.getMatchingPairs(0.65)).rejects.toThrow(/db boom/)
    })

    it('handles null model_version (legacy entries)', async () => {
      fake.setNext({
        data: [{ ...validRow, model_version: null }],
        error: null,
      })
      const result = await repo.getMatchingPairs(0)
      expect(result[0].modelVersion).toBeNull()
    })

    it('throws when relation_type is an unknown string', async () => {
      fake.setNext({
        data: [{ ...validRow, relation_type: 'unknown-type' }],
        error: null,
      })
      await expect(repo.getMatchingPairs(0)).rejects.toThrow(
        /Unknown.*relation_type/i,
      )
    })
  })

  describe('getEdgesByOrigin', () => {
    it('adds eq(ciiu_origen, ...) to the query chain', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.getEdgesByOrigin('5511', 0.7)

      expect(fake.spies.eq).toHaveBeenCalledWith('ciiu_origen', '5511')
      expect(fake.spies.eq).toHaveBeenCalledWith('has_match', true)
      expect(fake.spies.gte).toHaveBeenCalledWith('confidence', 0.7)
      expect(fake.spies.neq).toHaveBeenCalledWith('ciiu_destino', '*')
    })

    it('maps rows to CiiuEdge', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.getEdgesByOrigin('5511', 0)
      expect(result[0]).toBeInstanceOf(CiiuEdge)
    })

    it('returns empty array when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.getEdgesByOrigin('5511', 0)).toEqual([])
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('query failed') })
      await expect(repo.getEdgesByOrigin('5511', 0)).rejects.toThrow(
        /query failed/,
      )
    })
  })
})
