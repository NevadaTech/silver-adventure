import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { AiMatchEngine } from '@/recommendations/application/services/AiMatchEngine'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { CandidateSelector } from '@/recommendations/application/services/CandidateSelector'
import { CiiuPairEvaluator } from '@/recommendations/application/services/CiiuPairEvaluator'
import { DynamicValueChainRules } from '@/recommendations/application/services/DynamicValueChainRules'
import { FeatureVectorBuilder } from '@/recommendations/application/services/FeatureVectorBuilder'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { InMemoryCiiuGraphRepository } from '@/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository'
import { ExplainRecommendation } from '@/recommendations/application/use-cases/ExplainRecommendation'
import { GenerateRecommendations } from '@/recommendations/application/use-cases/GenerateRecommendations'
import { GetCompanyRecommendations } from '@/recommendations/application/use-cases/GetCompanyRecommendations'
import { GetGroupedCompanyRecommendations } from '@/recommendations/application/use-cases/GetGroupedCompanyRecommendations'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { CompanyRecommendationsController } from '@/recommendations/infrastructure/http/company-recommendations.controller'
import { RecommendationsController } from '@/recommendations/infrastructure/http/recommendations.controller'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import { StubLlmAdapter } from '@/shared/infrastructure/llm/StubLlmAdapter'

function makeWiring() {
  const companyRepo = new InMemoryCompanyRepository()
  const recRepo = new InMemoryRecommendationRepository()
  const cache = new InMemoryAiMatchCacheRepository()
  const ciiuRepo = new InMemoryCiiuTaxonomyRepository([
    CiiuActivity.create({
      code: '4631',
      titulo: 'Mayorista alimentos',
      seccion: 'G',
      division: '46',
      grupo: '463',
      tituloSeccion: 'x',
      tituloDivision: 'x',
      tituloGrupo: 'x',
    }),
    CiiuActivity.create({
      code: '5611',
      titulo: 'Restaurantes',
      seccion: 'I',
      division: '56',
      grupo: '561',
      tituloSeccion: 'x',
      tituloDivision: 'x',
      tituloGrupo: 'x',
    }),
  ])
  const gemini = new StubLlmAdapter('explanation from gemini')
  const aiEngine = new AiMatchEngine(gemini, cache, ciiuRepo)
  const evaluator = new CiiuPairEvaluator(aiEngine, cache)
  const featureBuilder = new FeatureVectorBuilder()
  const selector = new CandidateSelector()
  const peer = new PeerMatcher(featureBuilder)
  const graph = new InMemoryCiiuGraphRepository()
  const dynamicRules = new DynamicValueChainRules(graph)
  const valueChain = new ValueChainMatcher(dynamicRules, false)
  const alliance = new AllianceMatcher(dynamicRules, false)
  const generate = new GenerateRecommendations(
    companyRepo,
    recRepo,
    cache,
    selector,
    evaluator,
    featureBuilder,
    peer,
    valueChain,
    alliance,
  )
  const explain = new ExplainRecommendation(recRepo, companyRepo, gemini)
  const get = new GetCompanyRecommendations(recRepo, companyRepo)
  const grouped = new GetGroupedCompanyRecommendations(get)
  return {
    companyRepo,
    recRepo,
    gemini,
    controller: new RecommendationsController(generate, explain),
    companyController: new CompanyRecommendationsController(get, grouped),
  }
}

describe('RecommendationsController', () => {
  it('POST /generate runs the use case and returns stats', async () => {
    const setup = makeWiring()
    await setup.companyRepo.saveMany([
      Company.create({
        id: 'c1',
        razonSocial: 'A',
        ciiu: 'C1071',
        municipio: 'SANTA MARTA',
      }),
      Company.create({
        id: 'c2',
        razonSocial: 'B',
        ciiu: 'C1071',
        municipio: 'SANTA MARTA',
      }),
    ])

    const result = await setup.controller.generate({ enableAi: false })
    expect(result.totalRecommendations).toBeGreaterThanOrEqual(0)
    expect(result.byRelationType).toBeDefined()
  })

  it('POST /:id/explain returns the cached explanation without hitting gemini', async () => {
    const setup = makeWiring()
    await setup.companyRepo.saveMany([
      Company.create({
        id: 'src',
        razonSocial: 'Banano SA',
        ciiu: 'A0122',
        municipio: 'SANTA MARTA',
      }),
      Company.create({
        id: 'tgt',
        razonSocial: 'Mayorista SA',
        ciiu: 'G4631',
        municipio: 'SANTA MARTA',
      }),
    ])
    await setup.recRepo.saveAll([
      Recommendation.create({
        id: 'rec-1',
        sourceCompanyId: 'src',
        targetCompanyId: 'tgt',
        relationType: 'cliente',
        score: 0.85,
        reasons: Reasons.empty(),
        source: 'rule',
        explanation: 'cached',
      }),
    ])
    const spy = vi.spyOn(setup.gemini, 'generateText')

    const result = await setup.controller.explain('rec-1')
    expect(result.explanation).toBe('cached')
    expect(spy).not.toHaveBeenCalled()
  })

  it('POST /:id/explain throws NotFoundException when recommendation is unknown', async () => {
    const setup = makeWiring()
    await expect(setup.controller.explain('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})

describe('CompanyRecommendationsController', () => {
  it('GET /:id/recommendations returns the use case result', async () => {
    const setup = makeWiring()
    await setup.companyRepo.saveMany([
      Company.create({
        id: 'src',
        razonSocial: 'Acme',
        ciiu: 'G4631',
        municipio: 'SANTA MARTA',
      }),
      Company.create({
        id: 'tgt',
        razonSocial: 'Restaurante',
        ciiu: 'I5611',
        municipio: 'SANTA MARTA',
      }),
    ])
    await setup.recRepo.saveAll([
      Recommendation.create({
        id: 'r1',
        sourceCompanyId: 'src',
        targetCompanyId: 'tgt',
        relationType: 'cliente',
        score: 0.8,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
    ])

    const result = await setup.companyController.list('src')
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].id).toBe('r1')
    expect(result.recommendations[0].targetCompany?.razonSocial).toBe(
      'Restaurante',
    )
  })

  it('parses the type query param and ignores unknown values', async () => {
    const setup = makeWiring()
    await setup.companyRepo.saveMany([
      Company.create({
        id: 'src',
        razonSocial: 'Acme',
        ciiu: 'G4631',
        municipio: 'SANTA MARTA',
      }),
      Company.create({
        id: 'tgt',
        razonSocial: 'Restaurante',
        ciiu: 'I5611',
        municipio: 'SANTA MARTA',
      }),
    ])
    await setup.recRepo.saveAll([
      Recommendation.create({
        id: 'r1',
        sourceCompanyId: 'src',
        targetCompanyId: 'tgt',
        relationType: 'cliente',
        score: 0.8,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
    ])

    const filtered = await setup.companyController.list('src', 'cliente')
    expect(filtered.recommendations).toHaveLength(1)

    const ignored = await setup.companyController.list('src', 'invalid-type')
    expect(ignored.recommendations).toHaveLength(1)
  })

  it('parses the limit query param and clamps invalid values', async () => {
    const setup = makeWiring()
    await setup.companyRepo.saveMany([
      Company.create({
        id: 'src',
        razonSocial: 'Acme',
        ciiu: 'G4631',
        municipio: 'SANTA MARTA',
      }),
    ])
    for (let i = 0; i < 4; i++) {
      const id = `t${i}`
      await setup.companyRepo.saveMany([
        Company.create({
          id,
          razonSocial: id,
          ciiu: 'I5611',
          municipio: 'SANTA MARTA',
        }),
      ])
      await setup.recRepo.saveAll([
        Recommendation.create({
          id: `r${i}`,
          sourceCompanyId: 'src',
          targetCompanyId: id,
          relationType: 'cliente',
          score: 0.5 + i * 0.1,
          reasons: Reasons.empty(),
          source: 'rule',
        }),
      ])
    }

    const limited = await setup.companyController.list('src', undefined, '2')
    expect(limited.recommendations).toHaveLength(2)

    const invalid = await setup.companyController.list('src', undefined, 'oops')
    expect(invalid.recommendations.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /:id/recommendations/grouped returns recs grouped by relation type with partial flag', async () => {
    const setup = makeWiring()
    await setup.companyRepo.saveMany([
      Company.create({
        id: 'src',
        razonSocial: 'Acme',
        ciiu: 'G4631',
        municipio: 'SANTA MARTA',
      }),
      Company.create({
        id: 'tgt-c',
        razonSocial: 'Cliente',
        ciiu: 'I5611',
        municipio: 'SANTA MARTA',
      }),
      Company.create({
        id: 'tgt-p',
        razonSocial: 'Proveedor',
        ciiu: 'A0122',
        municipio: 'SANTA MARTA',
      }),
    ])
    await setup.recRepo.saveAll([
      Recommendation.create({
        id: 'rc',
        sourceCompanyId: 'src',
        targetCompanyId: 'tgt-c',
        relationType: 'cliente',
        score: 0.9,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
      Recommendation.create({
        id: 'rp',
        sourceCompanyId: 'src',
        targetCompanyId: 'tgt-p',
        relationType: 'proveedor',
        score: 0.8,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
    ])

    const result = await setup.companyController.grouped('src')

    expect(result.cliente.map((r) => r.id)).toEqual(['rc'])
    expect(result.proveedor.map((r) => r.id)).toEqual(['rp'])
    expect(result.aliado).toEqual([])
    expect(result.referente).toEqual([])
    expect(result.partial).toBe(true)
  })
})
