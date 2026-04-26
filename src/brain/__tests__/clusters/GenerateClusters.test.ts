import { beforeEach, describe, expect, it } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { GenerateClusters } from '@/clusters/application/use-cases/GenerateClusters'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { HeuristicClusterer } from '@/clusters/application/services/HeuristicClusterer'
import { PredefinedClusterMatcher } from '@/clusters/application/services/PredefinedClusterMatcher'
import { InMemoryClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterCiiuMappingRepository'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'

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
  let useCase: GenerateClusters

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository()
    clusterRepo = new InMemoryClusterRepository()
    membershipRepo = new InMemoryClusterMembershipRepository()
    mappingRepo = new InMemoryClusterCiiuMappingRepository()
    ciiuRepo = await seedTaxonomy()
    useCase = new GenerateClusters(
      companyRepo,
      clusterRepo,
      membershipRepo,
      new PredefinedClusterMatcher(mappingRepo),
      new HeuristicClusterer(ciiuRepo),
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

  it('wipes existing agent-owned memberships before regenerating', async () => {
    await membershipRepo.saveMany([{ clusterId: 'stale', companyId: 'old' }])
    await companyRepo.saveMany(
      repeat(5, { idPrefix: 'c', ciiu: 'G4711', municipio: 'SANTA MARTA' }),
    )

    await useCase.execute()

    const staleResidue = await membershipRepo.findCompanyIdsByCluster('stale')
    expect(staleResidue).toEqual([])
  })

  it('preserves memberships of clusters created by the signup flow (heur- prefix)', async () => {
    // Pin a freshly-onboarded company to a signup-owned cluster.
    await membershipRepo.saveMany([
      { clusterId: 'heur-grupo-107-santa-marta', companyId: 'signup-user' },
    ])
    // Add another agent-owned membership that SHOULD be wiped.
    await membershipRepo.saveMany([
      { clusterId: 'pred-stale', companyId: 'old-co' },
    ])
    // Ensure the agent has at least 5 ACTIVO companies so the regen runs.
    await companyRepo.saveMany(
      repeat(5, { idPrefix: 'c', ciiu: 'G4711', municipio: 'SANTA MARTA' }),
    )

    await useCase.execute()

    const signupSurvived = await membershipRepo.findCompanyIdsByCluster(
      'heur-grupo-107-santa-marta',
    )
    expect(signupSurvived).toEqual(['signup-user'])

    const staleResidue =
      await membershipRepo.findCompanyIdsByCluster('pred-stale')
    expect(staleResidue).toEqual([])
  })

  it('returns zeros when no companies are active', async () => {
    const stats = await useCase.execute()
    expect(stats.predefinedClusters).toBe(0)
    expect(stats.heuristicClusters).toBe(0)
    expect(stats.totalMemberships).toBe(0)
  })
})
