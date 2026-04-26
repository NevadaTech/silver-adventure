import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import { SupabaseAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/SupabaseAiMatchCacheRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of ['from', 'select', 'eq', 'upsert'] as const) {
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
  ciiu_origen: '0122',
  ciiu_destino: '4631',
  has_match: true,
  relation_type: 'cliente',
  confidence: 0.85,
  reason: 'Banano hacia mayoristas',
  cached_at: '2026-04-25T12:00:00Z',
}

describe('SupabaseAiMatchCacheRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseAiMatchCacheRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseAiMatchCacheRepository(fake.db)
  })

  describe('get', () => {
    it('returns mapped entry when found', async () => {
      fake.setNext({ data: validRow, error: null })
      const entry = await repo.get('0122', '4631')

      expect(fake.spies.from).toHaveBeenCalledWith('ai_match_cache')
      expect(fake.spies.eq).toHaveBeenCalledWith('ciiu_origen', '0122')
      expect(fake.spies.eq).toHaveBeenCalledWith('ciiu_destino', '4631')
      expect(entry).not.toBeNull()
      expect(entry).toBeInstanceOf(AiMatchCacheEntry)
      expect(entry!.relationType).toBe('cliente')
      expect(entry!.confidence).toBe(0.85)
    })

    it('returns null when no row', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.get('0122', '4631')).toBeNull()
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.get('0122', '4631')).rejects.toThrow(/boom/)
    })

    it('throws when relation_type from DB is unknown', async () => {
      fake.setNext({
        data: { ...validRow, relation_type: 'wat' },
        error: null,
      })
      await expect(repo.get('0122', '4631')).rejects.toThrow(
        /Unknown ai_match_cache relation_type/,
      )
    })
  })

  describe('put', () => {
    it('upserts the entry as a row using composite key', async () => {
      fake.setNext({ data: null, error: null })
      const entry = AiMatchCacheEntry.create({
        ciiuOrigen: '0122',
        ciiuDestino: '4631',
        hasMatch: true,
        relationType: 'cliente',
        confidence: 0.85,
        reason: 'r',
      })

      await repo.put(entry)

      expect(fake.spies.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ciiu_origen: '0122',
          ciiu_destino: '4631',
          has_match: true,
          relation_type: 'cliente',
          confidence: 0.85,
        }),
        { onConflict: 'ciiu_origen,ciiu_destino' },
      )
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      const entry = AiMatchCacheEntry.create({
        ciiuOrigen: '0122',
        ciiuDestino: '4631',
        hasMatch: false,
      })
      await expect(repo.put(entry)).rejects.toThrow(/boom/)
    })
  })

  describe('size', () => {
    it('returns total count via count: exact head: true', async () => {
      fake.setNext({ data: null, error: null, count: 42 })
      expect(await repo.size()).toBe(42)
      expect(fake.spies.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      })
    })

    it('returns 0 when count is null', async () => {
      fake.setNext({ data: null, error: null, count: null })
      expect(await repo.size()).toBe(0)
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.size()).rejects.toThrow(/boom/)
    })
  })
})
