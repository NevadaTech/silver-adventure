import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { InMemoryClusterCiiuMappingRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterCiiuMappingRepository'
import { InMemoryClusterMembershipRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterMembershipRepository'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'
import { ClassifyCompanyFromDescription } from '@/companies/application/use-cases/ClassifyCompanyFromDescription'
import { OnboardCompanyFromSignup } from '@/companies/application/use-cases/OnboardCompanyFromSignup'
import { CompanyOnboardingController } from '@/companies/infrastructure/http/company-onboarding.controller'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { FeatureVectorBuilder } from '@/recommendations/application/services/FeatureVectorBuilder'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import type { GeminiPort } from '@/shared/domain/GeminiPort'

class FixedGemini implements GeminiPort {
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

describe('CompanyOnboardingController', () => {
  let controller: CompanyOnboardingController

  beforeEach(async () => {
    const taxonomy = new InMemoryCiiuTaxonomyRepository([
      CiiuActivity.create({
        code: '5611',
        titulo: 'Expendio a la mesa',
        seccion: 'I',
        division: '56',
        grupo: '561',
        tituloSeccion: 'Alojamiento y comida',
        tituloDivision: 'Comidas y bebidas',
        tituloGrupo: 'Restaurantes',
        macroSector: 'Servicios',
      }),
    ])
    const clusterRepo = new InMemoryClusterRepository()
    const ciiuMapping = new InMemoryClusterCiiuMappingRepository()
    await clusterRepo.saveMany([
      Cluster.create({
        id: 'gastro',
        codigo: 'GASTRO',
        titulo: 'Gastronomía',
        tipo: 'predefined',
      }),
    ])
    await ciiuMapping.saveMany([{ clusterId: 'gastro', ciiuCode: '5611' }])

    const companyRepo = new InMemoryCompanyRepository()
    const recRepo = new InMemoryRecommendationRepository()
    const membershipRepo = new InMemoryClusterMembershipRepository()
    const featureBuilder = new FeatureVectorBuilder()

    const classify = new ClassifyCompanyFromDescription(
      new FixedGemini({
        ciiuCode: '5611',
        reasoning: 'restaurante',
      }),
      taxonomy,
    )
    const onboard = new OnboardCompanyFromSignup(
      classify,
      companyRepo,
      clusterRepo,
      ciiuMapping,
      membershipRepo,
      recRepo,
      new PeerMatcher(featureBuilder),
      new ValueChainMatcher(),
      new AllianceMatcher(),
    )
    controller = new CompanyOnboardingController(onboard)
  })

  it('returns DTO with company, classification, clusters and grouped recommendations', async () => {
    const result = await controller.onboard({
      userId: 'user-1',
      description: 'Restaurante boutique en El Rodadero',
      businessName: 'Casa Bambú',
      municipio: 'SANTA MARTA',
      yearsOfOperation: '5_10',
      hasChamber: true,
      nit: '900123456',
    })

    expect(result.company.id).toBe('900123456')
    expect(result.company.razonSocial).toBe('Casa Bambú')
    expect(result.company.ciiu).toBe('5611')
    expect(result.classification.ciiuTitulo).toBe('Expendio a la mesa')
    expect(result.classification.reasoning).toBe('restaurante')
    expect(result.clusters).toEqual([
      {
        id: 'gastro',
        codigo: 'GASTRO',
        titulo: 'Gastronomía',
        tipo: 'predefined',
        descripcion: null,
      },
    ])
    expect(result.recommendations).toEqual({
      proveedor: [],
      cliente: [],
      aliado: [],
      referente: [],
    })
  })

  it('throws BadRequestException when required fields are missing', async () => {
    await expect(
      controller.onboard({
        userId: '',
        description: 'Restaurante',
        businessName: 'Casa Bambú',
        municipio: 'SANTA MARTA',
      }),
    ).rejects.toThrow(BadRequestException)

    await expect(
      controller.onboard({
        userId: 'u-1',
        description: '   ',
        businessName: 'Casa Bambú',
        municipio: 'SANTA MARTA',
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects invalid yearsOfOperation values', async () => {
    await expect(
      controller.onboard({
        userId: 'u-1',
        description: 'Restaurante',
        businessName: 'Casa Bambú',
        municipio: 'SANTA MARTA',
        yearsOfOperation: 'forever' as never,
      }),
    ).rejects.toThrow(BadRequestException)
  })
})
