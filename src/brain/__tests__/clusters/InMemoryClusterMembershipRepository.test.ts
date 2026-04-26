import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'

describe('InMemoryClusterMembershipRepository', () => {
  let repo: InMemoryClusterMembershipRepository

  beforeEach(() => {
    repo = new InMemoryClusterMembershipRepository()
  })

  it('saves memberships and exposes them by company', async () => {
    await repo.saveMany([
      { clusterId: 'pred-1', companyId: 'c-1' },
      { clusterId: 'pred-2', companyId: 'c-1' },
      { clusterId: 'pred-1', companyId: 'c-2' },
    ])
    const clusters = await repo.findClusterIdsByCompany('c-1')
    expect(clusters.sort()).toEqual(['pred-1', 'pred-2'])
  })

  it('exposes memberships by cluster', async () => {
    await repo.saveMany([
      { clusterId: 'pred-1', companyId: 'c-1' },
      { clusterId: 'pred-1', companyId: 'c-2' },
      { clusterId: 'pred-2', companyId: 'c-3' },
    ])
    const companies = await repo.findCompanyIdsByCluster('pred-1')
    expect(companies.sort()).toEqual(['c-1', 'c-2'])
  })

  it('dedupes (cluster, company) pairs', async () => {
    await repo.saveMany([{ clusterId: 'pred-1', companyId: 'c-1' }])
    await repo.saveMany([{ clusterId: 'pred-1', companyId: 'c-1' }])
    expect(await repo.count()).toBe(1)
  })

  it('deleteAll wipes the store', async () => {
    await repo.saveMany([
      { clusterId: 'pred-1', companyId: 'c-1' },
      { clusterId: 'pred-2', companyId: 'c-2' },
    ])
    await repo.deleteAll()
    expect(await repo.count()).toBe(0)
    expect(await repo.findClusterIdsByCompany('c-1')).toEqual([])
  })

  describe('deleteAllExceptPrefix', () => {
    it('removes only memberships whose cluster_id does not start with the prefix', async () => {
      await repo.saveMany([
        { clusterId: 'pred-1', companyId: 'c-1' },
        { clusterId: 'div-47-SANTA_MARTA', companyId: 'c-2' },
        { clusterId: 'heur-grupo-107-santa-marta', companyId: 'c-3' },
        { clusterId: 'heur-grupo-108-santa-marta', companyId: 'c-4' },
      ])

      await repo.deleteAllExceptPrefix('heur-')

      expect(await repo.count()).toBe(2)
      const remaining = await repo.snapshot()
      expect(Array.from(remaining.keys()).sort()).toEqual([
        'heur-grupo-107-santa-marta',
        'heur-grupo-108-santa-marta',
      ])
    })

    it('is a no-op when nothing matches the prefix', async () => {
      await repo.saveMany([{ clusterId: 'pred-1', companyId: 'c-1' }])
      await repo.deleteAllExceptPrefix('heur-')
      expect(await repo.count()).toBe(0)
    })

    it('preserves everything when ALL ids match the prefix', async () => {
      await repo.saveMany([
        { clusterId: 'heur-a', companyId: 'c-1' },
        { clusterId: 'heur-b', companyId: 'c-2' },
      ])
      await repo.deleteAllExceptPrefix('heur-')
      expect(await repo.count()).toBe(2)
    })
  })

  it('returns empty arrays for unknown ids', async () => {
    expect(await repo.findClusterIdsByCompany('missing')).toEqual([])
    expect(await repo.findCompanyIdsByCluster('missing')).toEqual([])
  })

  it('does nothing on empty saveMany', async () => {
    await repo.saveMany([])
    expect(await repo.count()).toBe(0)
  })

  describe('snapshot', () => {
    it('returns a Map of clusterId to companyIds for every stored membership', async () => {
      await repo.saveMany([
        { clusterId: 'pred-1', companyId: 'c-1' },
        { clusterId: 'pred-1', companyId: 'c-2' },
        { clusterId: 'pred-2', companyId: 'c-1' },
        { clusterId: 'pred-2', companyId: 'c-3' },
      ])

      const snap = await repo.snapshot()
      expect(snap).toBeInstanceOf(Map)
      expect(snap.size).toBe(2)
      expect(snap.get('pred-1')!.sort()).toEqual(['c-1', 'c-2'])
      expect(snap.get('pred-2')!.sort()).toEqual(['c-1', 'c-3'])
    })

    it('returns an empty Map when store is empty', async () => {
      const snap = await repo.snapshot()
      expect(snap.size).toBe(0)
    })

    it('does not include duplicate companyIds within the same cluster', async () => {
      await repo.saveMany([
        { clusterId: 'pred-1', companyId: 'c-1' },
        { clusterId: 'pred-1', companyId: 'c-1' },
      ])

      const snap = await repo.snapshot()
      expect(snap.get('pred-1')).toEqual(['c-1'])
    })
  })
})
