import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterCiiuMappingRepository'

describe('InMemoryClusterCiiuMappingRepository', () => {
  let repo: InMemoryClusterCiiuMappingRepository

  beforeEach(() => {
    repo = new InMemoryClusterCiiuMappingRepository()
  })

  it('saves mappings and exposes them via findAll', async () => {
    await repo.saveMany([
      { clusterId: 'pred-1', ciiuCode: '4711' },
      { clusterId: 'pred-1', ciiuCode: '4712' },
    ])
    const all = await repo.findAll()
    expect(all).toHaveLength(2)
  })

  it('dedupes (cluster, ciiu) pairs', async () => {
    await repo.saveMany([{ clusterId: 'pred-1', ciiuCode: '4711' }])
    await repo.saveMany([{ clusterId: 'pred-1', ciiuCode: '4711' }])
    expect(await repo.count()).toBe(1)
  })

  it('getCiiuToClusterMap groups cluster ids by ciiu code', async () => {
    await repo.saveMany([
      { clusterId: 'pred-1', ciiuCode: '4711' },
      { clusterId: 'pred-2', ciiuCode: '4711' },
      { clusterId: 'pred-3', ciiuCode: '5611' },
    ])
    const map = await repo.getCiiuToClusterMap()
    expect(map.get('4711')!.sort()).toEqual(['pred-1', 'pred-2'])
    expect(map.get('5611')).toEqual(['pred-3'])
    expect(map.get('9999')).toBeUndefined()
  })

  it('does nothing on empty saveMany', async () => {
    await repo.saveMany([])
    expect(await repo.count()).toBe(0)
  })
})
