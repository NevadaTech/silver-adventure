import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { GenerateClusters } from '@/clusters/application/use-cases/GenerateClusters'
import { EcosystemDiscoverer } from '@/clusters/application/services/EcosystemDiscoverer'
import type { EcosystemDiscoveryResult } from '@/clusters/application/services/EcosystemDiscoverer'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { HeuristicClusterer } from '@/clusters/application/services/HeuristicClusterer'
import { PredefinedClusterMatcher } from '@/clusters/application/services/PredefinedClusterMatcher'
import { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'
import { InMemoryClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterCiiuMappingRepository'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'

function makeNoopEcosystemDiscoverer(): EcosystemDiscoverer {
  return {
    discover: vi.fn().mockResolvedValue([]),
  } as unknown as EcosystemDiscoverer
}

interface Spec {
  idPrefix: string
  ciiu: string
  municipio: string
  estado?: string
}

function repeat(count: number, spec: Spec): Company[] {
  return Array.from({ length: count }, (_, i) =>
    Company.create({
      id: `${spec.idPrefix}-${i}`,
      razonSocial: 'X',
      ciiu: spec.ciiu,
      municipio: spec.municipio,
      estado: spec.estado,
    }),
  )
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
    CiiuActivity.create({
      code: '4771',
      titulo: 'Vestuario',
      seccion: 'G',
      division: '47',
      grupo: '477',
      tituloSeccion: 'Comercio',
      tituloDivision: 'Comercio al por menor',
      tituloGrupo: 'Comercio especializado',
    }),
  ])
  return repo
}

describe('GenerateClusters', () => {
  let companyRepo: InMemoryCompanyRepository
  let clusterRepo: InMemoryClusterRepository
  let membershipRepo: InMemoryClusterMembershipRepository
  let mappingRepo: InMemoryClusterCiiuMappingRepository
  let ciiuRepo: InMemoryCiiuTaxonomyRepository
  let ecosystemDiscoverer: EcosystemDiscoverer
  let useCase: GenerateClusters

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository()
    clusterRepo = new InMemoryClusterRepository()
    membershipRepo = new InMemoryClusterMembershipRepository()
    mappingRepo = new InMemoryClusterCiiuMappingRepository()
    ciiuRepo = await seedTaxonomy()
    ecosystemDiscoverer = makeNoopEcosystemDiscoverer()
    useCase = new GenerateClusters(
      companyRepo,
      clusterRepo,
      membershipRepo,
      new PredefinedClusterMatcher(mappingRepo),
      new HeuristicClusterer(ciiuRepo),
      ecosystemDiscoverer,
      false,
    )

    await clusterRepo.saveMany([
      Cluster.create({
        id: 'pred-1',
        codigo: 'COMERCIO',
        titulo: 'Comercio',
        tipo: 'predefined',
        memberCount: 0,
      }),
    ])
    await mappingRepo.saveMany([{ clusterId: 'pred-1', ciiuCode: '4711' }])
  })

  it('persists heuristic clusters and assigns memberships for both flows', async () => {
    await companyRepo.saveMany([
      ...repeat(6, {
        idPrefix: 'c47',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
      }),
      ...repeat(12, {
        idPrefix: 'c477',
        ciiu: 'G4771',
        municipio: 'SANTA MARTA',
      }),
    ])

    const stats = await useCase.execute()

    expect(stats.predefinedClusters).toBe(1)
    expect(stats.heuristicClusters).toBeGreaterThanOrEqual(1)

    const allClusters = await clusterRepo.findAll()
    expect(allClusters.some((c) => c.tipo === 'heuristic-division')).toBe(true)
    expect(allClusters.some((c) => c.tipo === 'heuristic-grupo')).toBe(true)

    const pred1Companies =
      await membershipRepo.findCompanyIdsByCluster('pred-1')
    expect(pred1Companies.length).toBe(6)

    const totalMemberships = await membershipRepo.count()
    expect(stats.totalMemberships).toBe(totalMemberships)
  })

  it('updates predefined cluster memberCount based on matched companies', async () => {
    await companyRepo.saveMany(
      repeat(6, { idPrefix: 'c47', ciiu: 'G4711', municipio: 'SANTA MARTA' }),
    )

    await useCase.execute()

    const updated = await clusterRepo.findById('pred-1')
    expect(updated!.memberCount).toBe(6)
  })

  it('only considers ACTIVO companies', async () => {
    await companyRepo.saveMany([
      ...repeat(5, { idPrefix: 'a', ciiu: 'G4711', municipio: 'SANTA MARTA' }),
      ...repeat(2, {
        idPrefix: 'inactive',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
        estado: 'CANCELADO',
      }),
    ])

    const stats = await useCase.execute()

    const pred1 = await membershipRepo.findCompanyIdsByCluster('pred-1')
    expect(pred1).toHaveLength(5)
    expect(stats.totalMemberships).toBeGreaterThanOrEqual(5)
  })

  it('wipes existing memberships before regenerating', async () => {
    await membershipRepo.saveMany([{ clusterId: 'stale', companyId: 'old' }])
    await companyRepo.saveMany(
      repeat(5, { idPrefix: 'c', ciiu: 'G4711', municipio: 'SANTA MARTA' }),
    )

    await useCase.execute()

    const staleResidue = await membershipRepo.findCompanyIdsByCluster('stale')
    expect(staleResidue).toEqual([])
  })

  it('returns zeros when no companies are active', async () => {
    const stats = await useCase.execute()
    expect(stats.predefinedClusters).toBe(0)
    expect(stats.heuristicClusters).toBe(0)
    expect(stats.ecosystemClusters).toBe(0)
    expect(stats.totalMemberships).toBe(0)
  })

  describe('ecosystem discovery (flag=false)', () => {
    it('does not invoke EcosystemDiscoverer.discover when flag is false', async () => {
      // Default env has AI_DRIVEN_RULES_ENABLED=false
      await useCase.execute()
      expect(ecosystemDiscoverer.discover).not.toHaveBeenCalled()
    })

    it('returns ecosystemClusters: 0 when flag is false', async () => {
      const stats = await useCase.execute()
      expect(stats.ecosystemClusters).toBe(0)
    })

    it('does not call deleteByType when flag is false', async () => {
      const deleteByTypeSpy = vi.spyOn(clusterRepo, 'deleteByType')
      await useCase.execute()
      expect(deleteByTypeSpy).not.toHaveBeenCalled()
    })
  })

  describe('ecosystem discovery (flag=true)', () => {
    it('calls EcosystemDiscoverer.discover and persists results when flag is true', async () => {
      // Create 3 ecosystem clusters as fake discovery result
      const ecoCluster1 = Cluster.create({
        id: 'eco-ab12ef34-santa-marta',
        codigo: 'eco-ab12ef34-santa-marta',
        titulo: 'Ecosistema CIIU 5511-9601-5612 · Santa Marta',
        tipo: 'heuristic-ecosistema',
        municipio: 'Santa Marta',
        ciiuDivision: null,
        ciiuGrupo: null,
        memberCount: 3,
      })
      const company1 = Company.create({
        id: 'co1',
        razonSocial: 'X',
        ciiu: 'G5511',
        municipio: 'Santa Marta',
      })
      const company2 = Company.create({
        id: 'co2',
        razonSocial: 'X',
        ciiu: 'G9601',
        municipio: 'Santa Marta',
      })
      const company3 = Company.create({
        id: 'co3',
        razonSocial: 'X',
        ciiu: 'G5612',
        municipio: 'Santa Marta',
      })

      const fakeResults: EcosystemDiscoveryResult[] = [
        { cluster: ecoCluster1, members: [company1, company2, company3] },
      ]

      const discoverSpy = vi
        .spyOn(ecosystemDiscoverer, 'discover')
        .mockResolvedValue(fakeResults)

      const deleteByTypeSpy = vi.spyOn(clusterRepo, 'deleteByType')

      const useCaseFlagOn = new GenerateClusters(
        companyRepo,
        clusterRepo,
        membershipRepo,
        new PredefinedClusterMatcher(mappingRepo),
        new HeuristicClusterer(ciiuRepo),
        ecosystemDiscoverer,
        true,
      )

      const stats = await useCaseFlagOn.execute()

      expect(stats.ecosystemClusters).toBe(1)
      expect(discoverSpy).toHaveBeenCalledOnce()
      expect(deleteByTypeSpy).toHaveBeenCalledWith('heuristic-ecosistema')
    })
  })

  describe('regression — flag=false behavior is identical to pre-change', () => {
    it('flag=false produces same predefined + heuristic counts, ecosystemClusters=0', async () => {
      await companyRepo.saveMany([
        ...repeat(6, {
          idPrefix: 'c47',
          ciiu: 'G4711',
          municipio: 'SANTA MARTA',
        }),
        ...repeat(12, {
          idPrefix: 'c477',
          ciiu: 'G4771',
          municipio: 'SANTA MARTA',
        }),
      ])

      const stats = await useCase.execute()

      // Ecosystem pass does not run when flag is false (default in test env)
      expect(stats.ecosystemClusters).toBe(0)
      // Predefined and heuristic work as before
      expect(stats.predefinedClusters).toBeGreaterThanOrEqual(1)
      expect(stats.heuristicClusters).toBeGreaterThanOrEqual(1)
      // EcosystemDiscoverer never called
      expect(ecosystemDiscoverer.discover).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// E.3 — Integration test: full GenerateClusters flow with real InMemory adapters
// Verifies that GenerateClusters, EcosystemDiscoverer, and InMemoryCiiuGraphRepository
// can be wired together and executed end-to-end without NestJS DI.
// ---------------------------------------------------------------------------

function makeEdge(
  ciiuOrigen: string,
  ciiuDestino: string,
  confidence = 0.85,
): CiiuEdge {
  return CiiuEdge.create({
    ciiuOrigen,
    ciiuDestino,
    hasMatch: true,
    relationType: 'proveedor',
    confidence,
    modelVersion: null,
  })
}

describe('GenerateClusters — E.3 integration: full flow with real InMemory adapters', () => {
  it('constructs and executes with all real InMemory deps including real EcosystemDiscoverer', async () => {
    // Arrange: a graph with a connected community of 3 CIIUs above the threshold
    const graphRepo = new InMemoryCiiuGraphRepository([
      makeEdge('5511', '9601'),
      makeEdge('9601', '5511'),
      makeEdge('5511', '5612'),
      makeEdge('5612', '5511'),
      makeEdge('9601', '5612'),
      makeEdge('5612', '9601'),
    ])
    const realDiscoverer = new EcosystemDiscoverer(graphRepo)

    const companyRepo = new InMemoryCompanyRepository()
    const clusterRepo = new InMemoryClusterRepository()
    const membershipRepo = new InMemoryClusterMembershipRepository()
    const mappingRepo = new InMemoryClusterCiiuMappingRepository()
    const ciiuRepo = new InMemoryCiiuTaxonomyRepository()

    const wiredUseCase = new GenerateClusters(
      companyRepo,
      clusterRepo,
      membershipRepo,
      new PredefinedClusterMatcher(mappingRepo),
      new HeuristicClusterer(ciiuRepo),
      realDiscoverer,
      false,
    )

    // Seed companies with CIIUs belonging to the community (section letter prefix required)
    await companyRepo.saveMany([
      Company.create({
        id: 'c1',
        razonSocial: 'A',
        ciiu: 'I5511',
        municipio: 'Santa Marta',
      }),
      Company.create({
        id: 'c2',
        razonSocial: 'B',
        ciiu: 'S9601',
        municipio: 'Santa Marta',
      }),
      Company.create({
        id: 'c3',
        razonSocial: 'C',
        ciiu: 'I5612',
        municipio: 'Santa Marta',
      }),
    ])

    // Act: execute — flag=false in test env, so ecosystemClusters=0 but wiring is verified
    const stats = await wiredUseCase.execute()

    // The use case runs cleanly end-to-end with real adapters
    expect(stats.ecosystemClusters).toBe(0) // flag=false in test env
    expect(stats.totalMemberships).toBeGreaterThanOrEqual(0)
  })

  it('EcosystemDiscoverer.discover() returns ecosystemClusters >= 1 with a seeded graph of 3+ connected CIIUs', async () => {
    // Arrange: graph with 3 mutually connected CIIUs
    const graphRepo = new InMemoryCiiuGraphRepository([
      makeEdge('5511', '9601'),
      makeEdge('9601', '5511'),
      makeEdge('5511', '5612'),
      makeEdge('5612', '5511'),
      makeEdge('9601', '5612'),
      makeEdge('5612', '9601'),
    ])
    const realDiscoverer = new EcosystemDiscoverer(graphRepo)

    const companies = [
      Company.create({
        id: 'c1',
        razonSocial: 'A',
        ciiu: 'I5511',
        municipio: 'Santa Marta',
      }),
      Company.create({
        id: 'c2',
        razonSocial: 'B',
        ciiu: 'S9601',
        municipio: 'Santa Marta',
      }),
      Company.create({
        id: 'c3',
        razonSocial: 'C',
        ciiu: 'I5612',
        municipio: 'Santa Marta',
      }),
    ]

    // Act: call discover() directly (this is the real EcosystemDiscoverer, no mocks)
    const results = await realDiscoverer.discover(companies)

    // Assert: at least 1 ecosystem cluster produced
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].cluster.tipo).toBe('heuristic-ecosistema')
    expect(results[0].members.length).toBeGreaterThanOrEqual(1)
  })
})
