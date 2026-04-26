import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/SupabaseClusterCiiuMappingRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    upsert: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of ['from', 'select', 'upsert'] as const) {
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

describe('SupabaseClusterCiiuMappingRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseClusterCiiuMappingRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseClusterCiiuMappingRepository(fake.db)
  })

  describe('saveMany', () => {
    it('upserts mapped rows with composite onConflict', async () => {
      fake.setNext({ data: null, error: null })
      await repo.saveMany([
        { clusterId: 'pred-1', ciiuCode: '4711' },
        { clusterId: 'pred-1', ciiuCode: '4712' },
      ])
      expect(fake.spies.from).toHaveBeenCalledWith('cluster_ciiu_mapping')
      const [rows, opts] = fake.spies.upsert.mock.calls[0]
      expect(rows).toEqual([
        { cluster_id: 'pred-1', ciiu_code: '4711' },
        { cluster_id: 'pred-1', ciiu_code: '4712' },
      ])
      expect(opts).toEqual({ onConflict: 'cluster_id,ciiu_code' })
    })

    it('chunks payloads of more than 1000 rows', async () => {
      fake.setNext({ data: null, error: null })
      const rows = Array.from({ length: 1500 }, (_, i) => ({
        clusterId: `c-${i}`,
        ciiuCode: `${i}`,
      }))
      await repo.saveMany(rows)
      expect(fake.spies.upsert).toHaveBeenCalledTimes(2)
      expect(fake.spies.upsert.mock.calls[0][0]).toHaveLength(1000)
      expect(fake.spies.upsert.mock.calls[1][0]).toHaveLength(500)
    })

    it('does nothing for empty array', async () => {
      await repo.saveMany([])
      expect(fake.spies.upsert).not.toHaveBeenCalled()
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('bad') })
      await expect(
        repo.saveMany([{ clusterId: 'a', ciiuCode: '1' }]),
      ).rejects.toThrow(/bad/)
    })
  })

  describe('findAll', () => {
    it('returns mappings mapped from DB rows', async () => {
      fake.setNext({
        data: [{ cluster_id: 'pred-1', ciiu_code: '4711' }],
        error: null,
      })
      const result = await repo.findAll()
      expect(result).toEqual([{ clusterId: 'pred-1', ciiuCode: '4711' }])
    })

    it('returns [] when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findAll()).toEqual([])
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.findAll()).rejects.toThrow(/boom/)
    })
  })

  describe('getCiiuToClusterMap', () => {
    it('groups cluster ids by ciiu code', async () => {
      fake.setNext({
        data: [
          { cluster_id: 'pred-1', ciiu_code: '4711' },
          { cluster_id: 'pred-2', ciiu_code: '4711' },
          { cluster_id: 'pred-3', ciiu_code: '5611' },
        ],
        error: null,
      })
      const map = await repo.getCiiuToClusterMap()
      expect(map.get('4711')!.sort()).toEqual(['pred-1', 'pred-2'])
      expect(map.get('5611')).toEqual(['pred-3'])
    })
  })

  describe('count', () => {
    it('returns the count from head request', async () => {
      fake.setNext({ data: null, error: null, count: 8 })
      expect(await repo.count()).toBe(8)
    })

    it('returns 0 when count is null', async () => {
      fake.setNext({ data: null, error: null, count: null })
      expect(await repo.count()).toBe(0)
    })
  })
})
