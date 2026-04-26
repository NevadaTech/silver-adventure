import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { ExplainCluster } from '@/clusters/application/use-cases/ExplainCluster'
import { GenerateClusters } from '@/clusters/application/use-cases/GenerateClusters'
import { GetCompanyClusters } from '@/clusters/application/use-cases/GetCompanyClusters'
import { HeuristicClusterer } from '@/clusters/application/services/HeuristicClusterer'
import { PredefinedClusterMatcher } from '@/clusters/application/services/PredefinedClusterMatcher'
import type { EcosystemDiscoverer } from '@/clusters/application/services/EcosystemDiscoverer'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { InMemoryClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterCiiuMappingRepository'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'
import { ClustersController } from '@/clusters/infrastructure/http/clusters.controller'
import { CompanyClustersController } from '@/clusters/infrastructure/http/company-clusters.controller'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { StubLlmAdapter } from '@/shared/infrastructure/llm/StubLlmAdapter'

function makeNoopEcosystemDiscoverer(): EcosystemDiscoverer {
  return {
    discover: vi.fn().mockResolvedValue([]),
  } as unknown as EcosystemDiscoverer
}

function makeCompany(id: string, ciiu = 'G4711'): Company {
  return Company.create({
    id,
    razonSocial: `RS-${id}`,
    ciiu,
    municipio: 'SANTA MARTA',
  })
}

async function seedTaxonomy(): Promise<InMemoryCiiuTaxonomyRepository> {
  const repo = new InMemoryCiiuTaxonomyRepository()
  await repo.saveAll([
    CiiuActivity.create({
      code: '4711',
      titulo: 'Tiendas',
      seccion: 'G',
      division: '47',
      grupo: '471',
      tituloSeccion: 'Comercio',
      tituloDivision: 'Comercio al por menor',
      tituloGrupo: 'Comercio en establecimientos',
    }),
  ])
  return repo
}

describe('ClustersController', () => {
  let companyRepo: InMemoryCompanyRepository
  let clusterRepo: InMemoryClusterRepository
  let membershipRepo: InMemoryClusterMembershipRepository
  let mappingRepo: InMemoryClusterCiiuMappingRepository
  let ciiuRepo: InMemoryCiiuTaxonomyRepository
  let controller: ClustersController

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository()
    clusterRepo = new InMemoryClusterRepository()
    membershipRepo = new InMemoryClusterMembershipRepository()
    mappingRepo = new InMemoryClusterCiiuMappingRepository()
    ciiuRepo = await seedTaxonomy()

    const generate = new GenerateClusters(
      companyRepo,
      clusterRepo,
      membershipRepo,
      new PredefinedClusterMatcher(mappingRepo),
      new HeuristicClusterer(ciiuRepo),
      makeNoopEcosystemDiscoverer(),
      false,
    )
    const explain = new ExplainCluster(
      clusterRepo,
      membershipRepo,
      companyRepo,
      new StubLlmAdapter('AI desc'),
    )
    controller = new ClustersController(generate, explain, clusterRepo)
  })

  describe('POST /clusters/generate', () => {
    it('runs the generator and returns stats', async () => {
      await mappingRepo.saveMany([{ clusterId: 'pred-1', ciiuCode: '4711' }])
      await clusterRepo.saveMany([
        Cluster.create({
          id: 'pred-1',
          codigo: 'C1',
          titulo: 'C1',
          tipo: 'predefined',
        }),
      ])
      await companyRepo.saveMany(
        Array.from({ length: 6 }, (_, i) => makeCompany(`c-${i}`)),
      )
      const stats = await controller.generate()
      expect(stats.predefinedClusters).toBe(1)
      expect(stats.totalMemberships).toBeGreaterThan(0)
    })
  })

  describe('GET /clusters/:id/explain', () => {
    it('returns the cached descripcion when present', async () => {
      await clusterRepo.saveMany([
        Cluster.create({
          id: 'pred-1',
          codigo: 'C1',
          titulo: 'C1',
          descripcion: 'cached',
          tipo: 'predefined',
        }),
      ])
      const result = await controller.explain('pred-1')
      expect(result.description).toBe('cached')
    })

    it('throws NotFoundException when cluster does not exist', async () => {
      await expect(controller.explain('missing')).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})

describe('CompanyClustersController', () => {
  let clusterRepo: InMemoryClusterRepository
  let membershipRepo: InMemoryClusterMembershipRepository
  let controller: CompanyClustersController

  beforeEach(() => {
    clusterRepo = new InMemoryClusterRepository()
    membershipRepo = new InMemoryClusterMembershipRepository()
    controller = new CompanyClustersController(
      new GetCompanyClusters(membershipRepo, clusterRepo),
    )
  })

  it('returns DTOs for clusters that contain the company', async () => {
    await clusterRepo.saveMany([
      Cluster.create({
        id: 'pred-1',
        codigo: 'C1',
        titulo: 'C1',
        tipo: 'predefined',
      }),
    ])
    await membershipRepo.saveMany([{ clusterId: 'pred-1', companyId: 'c-1' }])
    const result = await controller.list('c-1')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'pred-1',
      codigo: 'C1',
      titulo: 'C1',
      descripcion: null,
      tipo: 'predefined',
      ciiuDivision: null,
      ciiuGrupo: null,
      municipio: null,
      memberCount: 0,
    })
  })

  it('returns empty array when company has no memberships', async () => {
    expect(await controller.list('missing')).toEqual([])
  })
})
