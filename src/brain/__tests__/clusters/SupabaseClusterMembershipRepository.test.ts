import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseClusterMembershipRepository } from '@/clusters/infrastructure/repositories/SupabaseClusterMembershipRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of [
    'from',
    'select',
    'eq',
    'neq',
    'upsert',
    'delete',
  ] as const) {
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

describe('SupabaseClusterMembershipRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseClusterMembershipRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseClusterMembershipRepository(fake.db)
  })

  describe('saveMany', () => {
    it('upserts mapped rows with composite onConflict', async () => {
      fake.setNext({ data: null, error: null })
      await repo.saveMany([
        { clusterId: 'pred-1', companyId: 'c-1' },
        { clusterId: 'pred-2', companyId: 'c-1' },
      ])
      expect(fake.spies.from).toHaveBeenCalledWith('cluster_members')
      expect(fake.spies.upsert).toHaveBeenCalledTimes(1)
      const [rows, opts] = fake.spies.upsert.mock.calls[0]
      expect(rows).toEqual([
        { cluster_id: 'pred-1', company_id: 'c-1' },
        { cluster_id: 'pred-2', company_id: 'c-1' },
      ])
      expect(opts).toEqual({ onConflict: 'cluster_id,company_id' })
    })

    it('chunks payloads of more than 1000 rows', async () => {
      fake.setNext({ data: null, error: null })
      const rows = Array.from({ length: 2300 }, (_, i) => ({
        clusterId: `c-${i}`,
        companyId: `co-${i}`,
      }))
      await repo.saveMany(rows)
      expect(fake.spies.upsert).toHaveBeenCalledTimes(3)
      expect(fake.spies.upsert.mock.calls[0][0]).toHaveLength(1000)
      expect(fake.spies.upsert.mock.calls[2][0]).toHaveLength(300)
    })

    it('does nothing for empty array', async () => {
      await repo.saveMany([])
      expect(fake.spies.upsert).not.toHaveBeenCalled()
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('bad') })
      await expect(
        repo.saveMany([{ clusterId: 'a', companyId: 'b' }]),
      ).rejects.toThrow(/bad/)
    })
  })

  describe('findClusterIdsByCompany', () => {
    it('returns the cluster_id column filtered by company_id', async () => {
      fake.setNext({
        data: [{ cluster_id: 'pred-1' }, { cluster_id: 'pred-2' }],
        error: null,
      })
      const result = await repo.findClusterIdsByCompany('c-1')
      expect(result).toEqual(['pred-1', 'pred-2'])
      expect(fake.spies.select).toHaveBeenCalledWith('cluster_id')
      expect(fake.spies.eq).toHaveBeenCalledWith('company_id', 'c-1')
    })

    it('returns [] when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findClusterIdsByCompany('c-1')).toEqual([])
    })
  })

  describe('findCompanyIdsByCluster', () => {
    it('returns the company_id column filtered by cluster_id', async () => {
      fake.setNext({ data: [{ company_id: 'c-1' }], error: null })
      const result = await repo.findCompanyIdsByCluster('pred-1')
      expect(result).toEqual(['c-1'])
      expect(fake.spies.select).toHaveBeenCalledWith('company_id')
      expect(fake.spies.eq).toHaveBeenCalledWith('cluster_id', 'pred-1')
    })
  })

  describe('deleteAll', () => {
    it('issues a delete unbounded by neq trick', async () => {
      fake.setNext({ data: null, error: null })
      await repo.deleteAll()
      expect(fake.spies.delete).toHaveBeenCalledTimes(1)
      expect(fake.spies.neq).toHaveBeenCalledWith('cluster_id', '')
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('forbidden') })
      await expect(repo.deleteAll()).rejects.toThrow(/forbidden/)
    })
  })

  describe('count', () => {
    it('returns the count from head request', async () => {
      fake.setNext({ data: null, error: null, count: 7 })
      expect(await repo.count()).toBe(7)
    })

    it('returns 0 when count is null', async () => {
      fake.setNext({ data: null, error: null, count: null })
      expect(await repo.count()).toBe(0)
    })
  })

  describe('snapshot', () => {
    it('selects both columns and groups company_ids by cluster_id', async () => {
      fake.setNext({
        data: [
          { cluster_id: 'pred-1', company_id: 'c-1' },
          { cluster_id: 'pred-1', company_id: 'c-2' },
          { cluster_id: 'pred-2', company_id: 'c-3' },
        ],
        error: null,
      })

      const snap = await repo.snapshot()

      expect(fake.spies.from).toHaveBeenCalledWith('cluster_members')
      expect(fake.spies.select).toHaveBeenCalledWith('cluster_id, company_id')
      expect(snap).toBeInstanceOf(Map)
      expect(snap.size).toBe(2)
      expect(snap.get('pred-1')!.sort()).toEqual(['c-1', 'c-2'])
      expect(snap.get('pred-2')).toEqual(['c-3'])
    })

    it('returns empty Map when no rows', async () => {
      fake.setNext({ data: [], error: null })
      const snap = await repo.snapshot()
      expect(snap.size).toBe(0)
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.snapshot()).rejects.toThrow(/boom/)
    })
  })
})
