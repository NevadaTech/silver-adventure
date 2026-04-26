import { beforeEach, describe, expect, it } from 'vitest'
import { GetCompanyClusters } from '@/clusters/application/use-cases/GetCompanyClusters'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'

describe('GetCompanyClusters', () => {
  let clusterRepo: InMemoryClusterRepository
  let membershipRepo: InMemoryClusterMembershipRepository
  let useCase: GetCompanyClusters

  beforeEach(() => {
    clusterRepo = new InMemoryClusterRepository()
    membershipRepo = new InMemoryClusterMembershipRepository()
    useCase = new GetCompanyClusters(membershipRepo, clusterRepo)
  })

  it('returns clusters the company belongs to', async () => {
    await clusterRepo.saveMany([
      Cluster.create({
        id: 'pred-1',
        codigo: 'C1',
        titulo: 'C1',
        tipo: 'predefined',
      }),
      Cluster.create({
        id: 'pred-2',
        codigo: 'C2',
        titulo: 'C2',
        tipo: 'predefined',
      }),
      Cluster.create({
        id: 'pred-3',
        codigo: 'C3',
        titulo: 'C3',
        tipo: 'predefined',
      }),
    ])
    await membershipRepo.saveMany([
      { clusterId: 'pred-1', companyId: 'c-1' },
      { clusterId: 'pred-3', companyId: 'c-1' },
      { clusterId: 'pred-2', companyId: 'c-2' },
    ])

    const { clusters } = await useCase.execute({ companyId: 'c-1' })

    expect(clusters.map((c) => c.id).sort()).toEqual(['pred-1', 'pred-3'])
  })

  it('returns empty array when company has no memberships', async () => {
    const { clusters } = await useCase.execute({ companyId: 'missing' })
    expect(clusters).toEqual([])
  })
})
