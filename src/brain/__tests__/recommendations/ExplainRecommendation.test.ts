import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { ExplainRecommendation } from '@/recommendations/application/use-cases/ExplainRecommendation'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import { StubLlmAdapter } from '@/shared/infrastructure/llm/StubLlmAdapter'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c',
    razonSocial: 'Acme',
    ciiu: 'I5611',
    municipio: 'SANTA MARTA',
    ...overrides,
  })

const recommendation = (
  overrides: Partial<{
    id: string
    sourceCompanyId: string
    targetCompanyId: string
    explanation: string | null
  }> = {},
): Recommendation =>
  Recommendation.create({
    id: overrides.id ?? 'rec-1',
    sourceCompanyId: overrides.sourceCompanyId ?? 'src',
    targetCompanyId: overrides.targetCompanyId ?? 'tgt',
    relationType: 'cliente',
    score: 0.85,
    reasons: Reasons.from([
      {
        feature: 'cadena_valor_directa',
        weight: 0.85,
        description: 'Banano hacia mayoristas',
      },
    ]),
    source: 'rule',
    explanation: overrides.explanation ?? null,
  })

describe('ExplainRecommendation', () => {
  let recRepo: InMemoryRecommendationRepository
  let companyRepo: InMemoryCompanyRepository
  let gemini: StubLlmAdapter
  let useCase: ExplainRecommendation

  beforeEach(async () => {
    recRepo = new InMemoryRecommendationRepository()
    companyRepo = new InMemoryCompanyRepository()
    gemini = new StubLlmAdapter('Generated explanation from Gemini')
    useCase = new ExplainRecommendation(recRepo, companyRepo, gemini)

    await companyRepo.saveMany([
      company({ id: 'src', razonSocial: 'Banano SA', ciiu: 'A0122' }),
      company({ id: 'tgt', razonSocial: 'Mayorista SA', ciiu: 'G4631' }),
    ])
    await recRepo.saveAll([recommendation()])
  })

  it('returns the cached explanation without calling Gemini', async () => {
    await recRepo.updateExplanation('rec-1', 'cached explanation')
    const spy = vi.spyOn(gemini, 'generateText')

    const result = await useCase.execute({ recommendationId: 'rec-1' })
    expect(result.explanation).toBe('cached explanation')
    expect(spy).not.toHaveBeenCalled()
  })

  it('calls Gemini and persists the explanation when missing', async () => {
    const spy = vi.spyOn(gemini, 'generateText')
    const result = await useCase.execute({ recommendationId: 'rec-1' })

    expect(result.explanation).toBe('Generated explanation from Gemini')
    expect(spy).toHaveBeenCalledTimes(1)

    const persisted = await recRepo.findById('rec-1')
    expect(persisted!.explanation).toBe('Generated explanation from Gemini')
  })

  it('builds the prompt with both companies and the relation type', async () => {
    let captured = ''
    vi.spyOn(gemini, 'generateText').mockImplementation(async (prompt) => {
      captured = prompt
      return 'enrichment'
    })

    await useCase.execute({ recommendationId: 'rec-1' })

    expect(captured).toContain('Banano SA')
    expect(captured).toContain('Mayorista SA')
    expect(captured).toContain('CIIU 0122')
    expect(captured).toContain('CIIU 4631')
    expect(captured).toContain('cliente')
  })

  it('includes the business definition of the relation type', async () => {
    let captured = ''
    vi.spyOn(gemini, 'generateText').mockImplementation(async (prompt) => {
      captured = prompt
      return 'enrichment'
    })

    await useCase.execute({ recommendationId: 'rec-1' })

    expect(captured.toLowerCase()).toContain('cliente')
    expect(captured.toLowerCase()).toMatch(/consume|adquiere|compra/)
  })

  it('includes value-chain rules applicable to the CIIU pair', async () => {
    let captured = ''
    vi.spyOn(gemini, 'generateText').mockImplementation(async (prompt) => {
      captured = prompt
      return 'enrichment'
    })

    await useCase.execute({ recommendationId: 'rec-1' })

    expect(captured).toContain('Banano hacia mayoristas')
  })

  it('includes shared ecosystems when both companies belong to one', async () => {
    let captured = ''
    vi.spyOn(gemini, 'generateText').mockImplementation(async (prompt) => {
      captured = prompt
      return 'enrichment'
    })

    await useCase.execute({ recommendationId: 'rec-1' })

    expect(captured).toContain('Agro Exportador')
  })

  it('translates structured reasons to natural language', async () => {
    let captured = ''
    vi.spyOn(gemini, 'generateText').mockImplementation(async (prompt) => {
      captured = prompt
      return 'enrichment'
    })

    await useCase.execute({ recommendationId: 'rec-1' })

    expect(captured.toLowerCase()).toContain('cadena de valor')
    expect(captured).not.toContain('"feature"')
    expect(captured).not.toContain('cadena_valor_directa')
  })

  it('includes both companies operational context (etapa, personal, ingreso)', async () => {
    await companyRepo.saveMany([
      company({
        id: 'src',
        razonSocial: 'Banano SA',
        ciiu: 'A0122',
        personal: 25,
        ingresoOperacion: 500_000_000,
      }),
      company({
        id: 'tgt',
        razonSocial: 'Mayorista SA',
        ciiu: 'G4631',
        personal: 80,
        ingresoOperacion: 2_000_000_000,
      }),
    ])

    let captured = ''
    vi.spyOn(gemini, 'generateText').mockImplementation(async (prompt) => {
      captured = prompt
      return 'enrichment'
    })

    await useCase.execute({ recommendationId: 'rec-1' })

    expect(captured).toContain('25')
    expect(captured).toContain('80')
    expect(captured.toLowerCase()).toMatch(/personal|empleados|colaboradores/)
    expect(captured.toLowerCase()).toMatch(/ingreso|facturaci/)
    expect(captured.toLowerCase()).toMatch(/etapa/)
  })

  it('throws when the recommendation does not exist', async () => {
    await expect(
      useCase.execute({ recommendationId: 'missing' }),
    ).rejects.toThrow(/Recommendation not found/)
  })

  it('throws when source or target company is missing', async () => {
    await recRepo.saveAll([
      recommendation({
        id: 'orphan',
        sourceCompanyId: 'src',
        targetCompanyId: 'ghost',
      }),
    ])
    await expect(
      useCase.execute({ recommendationId: 'orphan' }),
    ).rejects.toThrow(/Companies not found/)
  })
})
