import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { AiMatchEngine } from '@/recommendations/application/services/AiMatchEngine'
import { AllianceMatcher } from '@/recommendations/application/services/AllianceMatcher'
import { CandidateSelector } from '@/recommendations/application/services/CandidateSelector'
import { CiiuPairEvaluator } from '@/recommendations/application/services/CiiuPairEvaluator'
import { FeatureVectorBuilder } from '@/recommendations/application/services/FeatureVectorBuilder'
import { PeerMatcher } from '@/recommendations/application/services/PeerMatcher'
import { ValueChainMatcher } from '@/recommendations/application/services/ValueChainMatcher'
import { GenerateRecommendations } from '@/recommendations/application/use-cases/GenerateRecommendations'
import { InMemoryAiMatchCacheRepository } from '@/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import { StubLlmAdapter } from '@/shared/infrastructure/llm/StubLlmAdapter'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c',
    razonSocial: 'Acme',
    ciiu: 'I5611',
    municipio: 'SANTA MARTA',
    personal: 5,
    ingresoOperacion: 50_000_000,
    fechaMatricula: new Date('2022-01-01'),
    ...overrides,
  })

const ciius = [
  ['0122', 'A', '01', '012', 'Banano'],
  ['4631', 'G', '46', '463', 'Mayorista'],
  ['5611', 'I', '56', '561', 'Restaurante'],
  ['4921', 'H', '49', '492', 'Transporte turistico'],
  ['5511', 'I', '55', '551', 'Hoteles'],
  ['1071', 'C', '10', '107', 'Panaderia'],
] as const

function makeCiiuRepo() {
  return new InMemoryCiiuTaxonomyRepository(
    ciius.map(([code, seccion, division, grupo, titulo]) =>
      CiiuActivity.create({
        code,
        titulo,
        seccion,
        division,
        grupo,
        tituloSeccion: 'x',
        tituloDivision: 'x',
        tituloGrupo: 'x',
      }),
    ),
  )
}

function makeSetup({
  matchResponse,
}: {
  matchResponse?: Record<string, unknown>
} = {}) {
  const companyRepo = new InMemoryCompanyRepository()
  const recRepo = new InMemoryRecommendationRepository()
  const cache = new InMemoryAiMatchCacheRepository()
  const ciiuRepo = makeCiiuRepo()
  const gemini = new StubLlmAdapter(
    '',
    matchResponse ?? {
      has_match: true,
      relation_type: 'cliente',
      confidence: 0.85,
      reason: 'mayorista vende a restaurante',
    },
  )
  const aiEngine = new AiMatchEngine(gemini, cache, ciiuRepo)
  const evaluator = new CiiuPairEvaluator(aiEngine, cache)
  const selector = new CandidateSelector()
  const featureBuilder = new FeatureVectorBuilder()
  const peer = new PeerMatcher(featureBuilder)
  const valueChain = new ValueChainMatcher()
  const alliance = new AllianceMatcher()
  const useCase = new GenerateRecommendations(
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
  return {
    useCase,
    companyRepo,
    recRepo,
    cache,
    aiEngine,
    gemini,
    evaluator,
  }
}

describe('GenerateRecommendations', () => {
  describe('fallback mode (enableAi=false)', () => {
    let setup: ReturnType<typeof makeSetup>

    beforeEach(async () => {
      setup = makeSetup()
      await setup.companyRepo.saveMany([
        company({ id: 'p1', ciiu: 'C1071', municipio: 'SANTA MARTA' }),
        company({ id: 'p2', ciiu: 'C1071', municipio: 'SANTA MARTA' }),
        company({ id: 'banano', ciiu: 'A0122', municipio: 'CIENAGA' }),
        company({ id: 'mayor', ciiu: 'G4631', municipio: 'SANTA MARTA' }),
        company({ id: 'hotel', ciiu: 'I5511', municipio: 'SANTA MARTA' }),
        company({ id: 'transp', ciiu: 'H4921', municipio: 'SANTA MARTA' }),
      ])
    })

    it('runs hardcoded matchers without calling Gemini', async () => {
      const spy = vi.spyOn(setup.gemini, 'inferStructured')
      const result = await setup.useCase.execute({ enableAi: false })

      expect(spy).not.toHaveBeenCalled()
      expect(result.totalRecommendations).toBeGreaterThan(0)
    })

    it('persists recommendations via the repository', async () => {
      await setup.useCase.execute({ enableAi: false })

      const persisted = await setup.recRepo.findBySource('p1')
      expect(persisted.length).toBeGreaterThan(0)
      expect(persisted.every((r) => r.sourceCompanyId === 'p1')).toBe(true)
    })

    it('produces recommendations from cosine, rule, and ecosystem sources', async () => {
      await setup.useCase.execute({ enableAi: false })

      const allSources = new Set<string>()
      for (const id of ['p1', 'banano', 'hotel']) {
        const recs = await setup.recRepo.findBySource(id)
        for (const r of recs) allSources.add(r.source)
      }
      expect(allSources.has('cosine')).toBe(true)
      expect(allSources.has('rule')).toBe(true)
      expect(allSources.has('ecosystem')).toBe(true)
    })

    it('clears existing recommendations before saving the new batch', async () => {
      await setup.useCase.execute({ enableAi: false })
      const before = await setup.recRepo.findBySource('p1')
      await setup.useCase.execute({ enableAi: false })
      const after = await setup.recRepo.findBySource('p1')

      expect(before.length).toBe(after.length)
      for (const beforeRec of before) {
        expect(after.some((a) => a.id === beforeRec.id)).toBe(false)
      }
    })

    it('skips inactive companies', async () => {
      await setup.companyRepo.saveMany([
        company({
          id: 'inactivo',
          ciiu: 'C1071',
          municipio: 'SANTA MARTA',
          estado: 'CANCELADO',
        }),
      ])

      await setup.useCase.execute({ enableAi: false })
      expect(await setup.recRepo.countBySource('inactivo')).toBe(0)
    })
  })

  describe('limit and dedupe', () => {
    it('caps each company to at most 20 total recommendations', async () => {
      const setup = makeSetup()
      const companies: Company[] = [
        company({ id: 'src', ciiu: 'G4631', municipio: 'SANTA MARTA' }),
      ]
      for (let i = 0; i < 40; i++) {
        companies.push(
          company({ id: `t${i}`, ciiu: 'I5611', municipio: 'SANTA MARTA' }),
        )
      }
      await setup.companyRepo.saveMany(companies)

      await setup.useCase.execute({ enableAi: false })
      expect(await setup.recRepo.countBySource('src')).toBeLessThanOrEqual(20)
    })

    it('caps each (relationType) to at most 5 recommendations per company', async () => {
      const setup = makeSetup()
      const companies: Company[] = [
        company({ id: 'banano', ciiu: 'A0122', municipio: 'SANTA MARTA' }),
      ]
      for (let i = 0; i < 12; i++) {
        companies.push(
          company({
            id: `m${i}`,
            ciiu: 'G4631',
            municipio: 'SANTA MARTA',
          }),
        )
      }
      await setup.companyRepo.saveMany(companies)

      await setup.useCase.execute({ enableAi: false })
      const clientes = await setup.recRepo.findBySourceAndType(
        'banano',
        'cliente',
      )
      expect(clientes.length).toBeLessThanOrEqual(5)
    })
  })

  describe('AI-first mode', () => {
    it('marks recommendations with source=ai-inferred when enableAi is true', async () => {
      const setup = makeSetup({
        matchResponse: {
          has_match: true,
          relation_type: 'cliente',
          confidence: 0.85,
          reason: 'r',
        },
      })
      await setup.companyRepo.saveMany([
        company({ id: 'mayor', ciiu: 'G4631', municipio: 'SANTA MARTA' }),
        company({ id: 'rest', ciiu: 'I5611', municipio: 'SANTA MARTA' }),
      ])

      await setup.useCase.execute({ enableAi: true })
      const recs = await setup.recRepo.findBySource('mayor')

      expect(recs.length).toBeGreaterThan(0)
      expect(recs.every((r) => r.source === 'ai-inferred')).toBe(true)
    })

    it('falls back to hardcoded matchers when AI orchestration throws', async () => {
      const setup = makeSetup()
      vi.spyOn(setup.evaluator, 'evaluateAll').mockRejectedValue(
        new Error('rate limited'),
      )
      await setup.companyRepo.saveMany([
        company({ id: 'p1', ciiu: 'C1071', municipio: 'SANTA MARTA' }),
        company({ id: 'p2', ciiu: 'C1071', municipio: 'SANTA MARTA' }),
      ])

      await setup.useCase.execute({ enableAi: true })
      const recs = await setup.recRepo.findBySource('p1')
      expect(recs.length).toBeGreaterThan(0)
      expect(recs.every((r) => r.source !== 'ai-inferred')).toBe(true)
    })
  })

  it('returns stats describing the persisted batch', async () => {
    const setup = makeSetup()
    await setup.companyRepo.saveMany([
      company({ id: 'p1', ciiu: 'C1071', municipio: 'SANTA MARTA' }),
      company({ id: 'p2', ciiu: 'C1071', municipio: 'SANTA MARTA' }),
    ])

    const result = await setup.useCase.execute({ enableAi: false })

    expect(result.totalRecommendations).toBeGreaterThanOrEqual(0)
    expect(result.companiesWithRecs).toBeGreaterThanOrEqual(0)
    expect(result.byRelationType).toBeDefined()
  })
})
