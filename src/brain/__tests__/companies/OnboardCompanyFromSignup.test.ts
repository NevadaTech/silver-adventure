import { beforeEach, describe, expect, it } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { InMemoryClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterCiiuMappingRepository'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { ClassifyCompanyFromDescription } from '@/companies/application/use-cases/ClassifyCompanyFromDescription'
import { OnboardCompanyFromSignup } from '@/companies/application/use-cases/OnboardCompanyFromSignup'
import { AiCacheExpander } from '@/recommendations/application/services/AiCacheExpander'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { DynamicValueChainRules } from '@/recommendations/application/services/DynamicValueChainRules'
import { FeatureVectorBuilder } from '@/recommendations/application/services/FeatureVectorBuilder'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'
import { RecommendationLimiter } from '@/recommendations/application/services/RecommendationLimiter'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { AiMatchCacheEntry } from '@/recommendations/domain/entities/AiMatchCacheEntry'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import type { LlmPort } from '@/shared/domain/LlmPort'

class FixedGemini implements LlmPort {
  constructor(private readonly response: unknown) {}
  async generateText() {
    return JSON.stringify(this.response)
  }
  async inferStructured<T>(
    _prompt: string,
    validate: (raw: unknown) => T,
  ): Promise<T> {
    return validate(this.response)
  }
}

const restaurantActivity = CiiuActivity.create({
  code: '5611',
  titulo: 'Expendio a la mesa de comidas preparadas',
  seccion: 'I',
  division: '56',
  grupo: '561',
  tituloSeccion: 'Alojamiento y servicios de comida',
  tituloDivision: 'Servicios de comidas y bebidas',
  tituloGrupo: 'Restaurantes',
  macroSector: 'Servicios',
})

const gastronomiaCluster = Cluster.create({
  id: 'cluster-gastronomia',
  codigo: 'GASTRO',
  titulo: 'Gastronomía Caribe',
  descripcion: 'Restaurantes y servicios de comida del Caribe',
  tipo: 'predefined',
  memberCount: 0,
})

const turismoCluster = Cluster.create({
  id: 'cluster-turismo',
  codigo: 'TUR',
  titulo: 'Turismo y experiencias',
  tipo: 'predefined',
  memberCount: 0,
})

function buildFixtures() {
  const taxonomy = new InMemoryCiiuTaxonomyRepository([restaurantActivity])
  const companyRepo = new InMemoryCompanyRepository()
  const clusterRepo = new InMemoryClusterRepository()
  const ciiuMapping = new InMemoryClusterCiiuMappingRepository()
  const membershipRepo = new InMemoryClusterMembershipRepository()
  const recRepo = new InMemoryRecommendationRepository()
  const aiCache = new InMemoryAiMatchCacheRepository()
  const gemini = new FixedGemini({
    ciiuCode: '5611',
    reasoning: 'Restaurante de comida del Caribe — clase 5611.',
  })
  const classify = new ClassifyCompanyFromDescription(gemini, taxonomy)
  const featureBuilder = new FeatureVectorBuilder()
  const cacheExpander = new AiCacheExpander(aiCache, featureBuilder)
  const limiter = new RecommendationLimiter()

  return {
    taxonomy,
    companyRepo,
    clusterRepo,
    ciiuMapping,
    membershipRepo,
    recRepo,
    aiCache,
    classify,
    featureBuilder,
    cacheExpander,
    limiter,
  }
}

async function buildUseCase(
  overrides: Partial<{
    classify: ClassifyCompanyFromDescription
  }> = {},
) {
  const f = buildFixtures()
  await f.clusterRepo.saveMany([gastronomiaCluster, turismoCluster])
  await f.ciiuMapping.saveMany([
    { clusterId: 'cluster-gastronomia', ciiuCode: '5611' },
    { clusterId: 'cluster-turismo', ciiuCode: '5611' },
  ])
  const useCase = new OnboardCompanyFromSignup(
    overrides.classify ?? f.classify,
    f.companyRepo,
    f.clusterRepo,
    f.ciiuMapping,
    f.membershipRepo,
    f.recRepo,
    new PeerMatcher(f.featureBuilder),
    new ValueChainMatcher(
      new DynamicValueChainRules(new InMemoryCiiuGraphRepository()),
      false,
    ),
    new AllianceMatcher(
      new DynamicValueChainRules(new InMemoryCiiuGraphRepository()),
      false,
    ),
    f.cacheExpander,
    f.limiter,
  )
  return { useCase, ...f }
}

describe('OnboardCompanyFromSignup', () => {
  let fixtures: Awaited<ReturnType<typeof buildUseCase>>

  beforeEach(async () => {
    fixtures = await buildUseCase()
  })

  it('classifies, persists the company, and links clusters via CIIU mapping', async () => {
    const result = await fixtures.useCase.execute({
      userId: 'user-1',
      description: 'Restaurante boutique en El Rodadero, comida del Caribe.',
      businessName: 'Casa Bambú',
      municipio: 'SANTA MARTA',
      yearsOfOperation: '5_10',
      hasChamber: true,
      nit: '900123456',
    })

    expect(result.company.ciiu).toBe('5611')
    expect(result.company.razonSocial).toBe('Casa Bambú')
    expect(result.company.municipio).toBe('SANTA MARTA')
    expect(result.classification.reasoning).toContain('5611')
    expect(result.classification.ciiuTitulo).toContain('Expendio a la mesa')
    expect(result.clusters.map((c) => c.id).sort()).toEqual(
      ['cluster-gastronomia', 'cluster-turismo'].sort(),
    )

    const stored = await fixtures.companyRepo.findById(result.company.id)
    expect(stored).not.toBeNull()
    const memberships = await fixtures.membershipRepo.findClusterIdsByCompany(
      result.company.id,
    )
    expect(memberships.sort()).toEqual(
      ['cluster-gastronomia', 'cluster-turismo'].sort(),
    )
  })

  it('uses sanitized nit as company id when nit is provided', async () => {
    const result = await fixtures.useCase.execute({
      userId: 'user-1',
      description: 'Restaurante',
      businessName: 'Acme SAS',
      municipio: 'SANTA MARTA',
      nit: '900-123.456',
    })
    expect(result.company.id).toBe('900123456')
  })

  it('falls back to signup-{userId} when no nit is provided', async () => {
    const result = await fixtures.useCase.execute({
      userId: 'abc-uuid',
      description: 'Restaurante',
      businessName: 'Acme',
      municipio: 'SANTA MARTA',
    })
    expect(result.company.id).toBe('signup-abc-uuid')
  })

  it('derives fechaMatricula and etapa from yearsOfOperation', async () => {
    const newbie = await fixtures.useCase.execute({
      userId: 'u-newbie',
      description: 'Restaurante recién abierto',
      businessName: 'Nuevo',
      municipio: 'SANTA MARTA',
      yearsOfOperation: 'menos_1',
    })
    expect(newbie.company.etapa).toBe('nacimiento')

    const veteran = await fixtures.useCase.execute({
      userId: 'u-vet',
      description: 'Restaurante de toda la vida',
      businessName: 'Vetera',
      municipio: 'SANTA MARTA',
      yearsOfOperation: 'mas_10',
    })
    expect(['consolidacion', 'madurez']).toContain(veteran.company.etapa)
  })

  it('generates recommendations linking the new company against the existing universe', async () => {
    await fixtures.companyRepo.saveMany([
      Company.create({
        id: 'peer-1',
        razonSocial: 'Restaurante existente',
        ciiu: 'I5611',
        municipio: 'SANTA MARTA',
        fechaMatricula: new Date('2020-01-01'),
        personal: 5,
      }),
      Company.create({
        id: 'peer-2',
        razonSocial: 'Otro restaurante',
        ciiu: 'I5613',
        municipio: 'SANTA MARTA',
        fechaMatricula: new Date('2021-01-01'),
        personal: 3,
      }),
    ])

    const result = await fixtures.useCase.execute({
      userId: 'u-1',
      description: 'Restaurante',
      businessName: 'Casa Bambú',
      municipio: 'SANTA MARTA',
      yearsOfOperation: '3_5',
    })

    expect(result.recommendations.length).toBeGreaterThan(0)
    for (const rec of result.recommendations) {
      expect(rec.sourceCompanyId).toBe(result.company.id)
    }

    const persisted = await fixtures.recRepo.findBySource(result.company.id)
    expect(persisted.length).toBe(result.recommendations.length)
  })

  it('auto-creates a heuristic-grupo cluster when no predefined mapping exists', async () => {
    const f = buildFixtures()
    const useCase = new OnboardCompanyFromSignup(
      f.classify,
      f.companyRepo,
      f.clusterRepo,
      f.ciiuMapping,
      f.membershipRepo,
      f.recRepo,
      new PeerMatcher(f.featureBuilder),
      new ValueChainMatcher(
        new DynamicValueChainRules(new InMemoryCiiuGraphRepository()),
        false,
      ),
      new AllianceMatcher(
        new DynamicValueChainRules(new InMemoryCiiuGraphRepository()),
        false,
      ),
      f.cacheExpander,
      f.limiter,
    )

    const result = await useCase.execute({
      userId: 'lonely',
      description: 'Restaurante',
      businessName: 'Solo',
      municipio: 'SANTA MARTA',
    })

    expect(result.clusters).toHaveLength(1)
    const created = result.clusters[0]
    expect(created.tipo).toBe('heuristic-grupo')
    expect(created.ciiuGrupo).toBe('561')
    expect(created.ciiuDivision).toBe('56')
    expect(created.municipio).toBe('SANTA MARTA')

    const persisted = await f.clusterRepo.findById(created.id)
    expect(persisted).not.toBeNull()

    const memberships = await f.membershipRepo.findClusterIdsByCompany(
      result.company.id,
    )
    expect(memberships).toEqual([created.id])
  })

  it('reuses an existing heuristic-grupo cluster instead of creating a duplicate', async () => {
    const f = buildFixtures()
    const existing = Cluster.create({
      id: 'heur-grupo-561-santa-marta',
      codigo: 'H-561-SANTA-MARTA',
      titulo: 'Grupo 561 en SANTA MARTA',
      tipo: 'heuristic-grupo',
      ciiuDivision: '56',
      ciiuGrupo: '561',
      municipio: 'SANTA MARTA',
    })
    await f.clusterRepo.saveMany([existing])

    const useCase = new OnboardCompanyFromSignup(
      f.classify,
      f.companyRepo,
      f.clusterRepo,
      f.ciiuMapping,
      f.membershipRepo,
      f.recRepo,
      new PeerMatcher(f.featureBuilder),
      new ValueChainMatcher(
        new DynamicValueChainRules(new InMemoryCiiuGraphRepository()),
        false,
      ),
      new AllianceMatcher(
        new DynamicValueChainRules(new InMemoryCiiuGraphRepository()),
        false,
      ),
      f.cacheExpander,
      f.limiter,
    )

    const result = await useCase.execute({
      userId: 'reuser',
      description: 'Restaurante',
      businessName: 'Casa Reuse',
      municipio: 'SANTA MARTA',
    })

    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0].id).toBe('heur-grupo-561-santa-marta')
    expect(await f.clusterRepo.count()).toBe(1)
  })

  it('uses AI match cache hits when present to seed ai-inferred recommendations', async () => {
    // Use a CIIU pair (5611 ↔ 0122) with NO hardcoded rule so the AI cache is
    // the only producer of the recommendation. This isolates the AI cache wiring.
    await fixtures.aiCache.put(
      AiMatchCacheEntry.create({
        ciiuOrigen: '0122',
        ciiuDestino: '5611',
        hasMatch: true,
        relationType: 'aliado',
        confidence: 0.8,
        reason: 'Sinergia agro–gastronomía: producto local en menú',
      }),
    )
    await fixtures.companyRepo.saveMany([
      Company.create({
        id: 'finca-1',
        razonSocial: 'Finca La Esperanza',
        ciiu: 'A0122',
        municipio: 'SANTA MARTA',
        fechaMatricula: new Date('2018-01-01'),
        personal: 12,
      }),
    ])

    const result = await fixtures.useCase.execute({
      userId: 'u-ai',
      description: 'Restaurante',
      businessName: 'Casa Bambú',
      municipio: 'SANTA MARTA',
      yearsOfOperation: '3_5',
    })

    const aiInferred = result.recommendations.filter(
      (r) => r.source === 'ai-inferred',
    )
    expect(aiInferred.length).toBeGreaterThan(0)
    expect(
      aiInferred.some(
        (r) => r.targetCompanyId === 'finca-1' && r.relationType === 'aliado',
      ),
    ).toBe(true)
  })

  it('caps recommendations per relation type to avoid flooding', async () => {
    const peers = Array.from({ length: 50 }, (_, i) =>
      Company.create({
        id: `peer-${i}`,
        razonSocial: `Peer ${i}`,
        ciiu: 'I5611',
        municipio: 'SANTA MARTA',
        fechaMatricula: new Date('2020-01-01'),
        personal: 4,
      }),
    )
    await fixtures.companyRepo.saveMany(peers)

    const result = await fixtures.useCase.execute({
      userId: 'u-many',
      description: 'Restaurante',
      businessName: 'Casa Bambú',
      municipio: 'SANTA MARTA',
    })

    const referentes = result.recommendations.filter(
      (r) => r.relationType === 'referente',
    )
    expect(referentes.length).toBeLessThanOrEqual(2)
  })
})
