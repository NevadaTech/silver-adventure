import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { GetClusterMembers } from '@/clusters/application/use-cases/GetClusterMembers'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'

const CLUSTER_ID = 'div-47-SANTA_MARTA'

function makeCompany(id: string): Company {
  return Company.create({
    id,
    razonSocial: `RS-${id}`,
    ciiu: 'G4711',
    municipio: 'SANTA MARTA',
  })
}

describe('GetClusterMembers', () => {
  let clusterRepo: InMemoryClusterRepository
  let membershipRepo: InMemoryClusterMembershipRepository
  let companyRepo: InMemoryCompanyRepository
  let recRepo: InMemoryRecommendationRepository
  let useCase: GetClusterMembers

  beforeEach(async () => {
    clusterRepo = new InMemoryClusterRepository()
    membershipRepo = new InMemoryClusterMembershipRepository()
    companyRepo = new InMemoryCompanyRepository()
    recRepo = new InMemoryRecommendationRepository()
    useCase = new GetClusterMembers(
      clusterRepo,
      membershipRepo,
      companyRepo,
      recRepo,
    )

    await clusterRepo.saveMany([
      Cluster.create({
        id: CLUSTER_ID,
        codigo: '47-SANTA_MARTA',
        titulo: 'Comercio Santa Marta',
        tipo: 'heuristic-division',
        ciiuDivision: '47',
        municipio: 'SANTA MARTA',
        memberCount: 3,
      }),
    ])
    await companyRepo.saveMany([
      makeCompany('comp-self'),
      makeCompany('comp-a'),
      makeCompany('comp-b'),
    ])
    await membershipRepo.saveMany([
      { clusterId: CLUSTER_ID, companyId: 'comp-self' },
      { clusterId: CLUSTER_ID, companyId: 'comp-a' },
      { clusterId: CLUSTER_ID, companyId: 'comp-b' },
    ])
  })

  it('throws NotFoundException for an unknown cluster', async () => {
    await expect(useCase.execute({ clusterId: 'nope' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('returns enriched members and no value chains when no perspective is given', async () => {
    const result = await useCase.execute({ clusterId: CLUSTER_ID })

    expect(result.cluster.id).toBe(CLUSTER_ID)
    expect(result.cluster.etapa).toBeNull()
    expect(result.members.map((m) => m.id).sort()).toEqual([
      'comp-a',
      'comp-b',
      'comp-self',
    ])
    expect(result.members.every((m) => m.isSelf === false)).toBe(true)
    expect(result.valueChains).toEqual([])
    expect(result.partial).toBe(false)
  })

  it('exposes cluster.etapa when the cluster is etapa-aware', async () => {
    const ETAPA_CLUSTER_ID = 'eta-crecimiento-SANTA_MARTA'
    await clusterRepo.saveMany([
      Cluster.create({
        id: ETAPA_CLUSTER_ID,
        codigo: 'ETA-crecimiento-SM',
        titulo: 'Empresas en Crecimiento en Santa Marta',
        tipo: 'heuristic-etapa',
        municipio: 'SANTA MARTA',
        etapa: 'crecimiento',
        memberCount: 1,
      }),
    ])
    await membershipRepo.saveMany([
      { clusterId: ETAPA_CLUSTER_ID, companyId: 'comp-self' },
    ])

    const result = await useCase.execute({ clusterId: ETAPA_CLUSTER_ID })
    expect(result.cluster.etapa).toBe('crecimiento')
  })

  it('flags self and computes value chains scoped to cluster members', async () => {
    await recRepo.saveAll([
      Recommendation.create({
        id: '00000000-0000-4000-8000-000000000001',
        sourceCompanyId: 'comp-self',
        targetCompanyId: 'comp-a',
        relationType: 'proveedor',
        score: 0.9,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
      Recommendation.create({
        id: '00000000-0000-4000-8000-000000000002',
        sourceCompanyId: 'comp-self',
        targetCompanyId: 'comp-b',
        relationType: 'proveedor',
        score: 0.7,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
      Recommendation.create({
        id: '00000000-0000-4000-8000-000000000003',
        sourceCompanyId: 'comp-self',
        targetCompanyId: 'outsider',
        relationType: 'cliente',
        score: 0.95,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
    ])

    const result = await useCase.execute({
      clusterId: CLUSTER_ID,
      perspectiveCompanyId: 'comp-self',
    })

    const self = result.members.find((m) => m.id === 'comp-self')
    expect(self?.isSelf).toBe(true)

    expect(result.valueChains).toHaveLength(1)
    expect(result.valueChains[0]).toMatchObject({
      relationType: 'proveedor',
      count: 2,
    })
    expect(result.valueChains[0].topTargets.map((t) => t.id)).toEqual([
      'comp-a',
      'comp-b',
    ])
  })

  it('respects the limit parameter and reports partial=true when applicable', async () => {
    const result = await useCase.execute({ clusterId: CLUSTER_ID, limit: 2 })
    expect(result.members).toHaveLength(2)
    expect(result.partial).toBe(true)
  })
})
