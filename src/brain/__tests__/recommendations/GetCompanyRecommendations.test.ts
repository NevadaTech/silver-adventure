import { beforeEach, describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { GetCompanyRecommendations } from '@/recommendations/application/use-cases/GetCompanyRecommendations'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'

const company = (overrides: Partial<CreateCompanyInput> = {}): Company =>
  Company.create({
    id: 'c',
    razonSocial: 'Acme',
    ciiu: 'I5611',
    municipio: 'SANTA MARTA',
    ...overrides,
  })

const rec = (
  id: string,
  overrides: Partial<{
    score: number
    relationType: 'referente' | 'cliente' | 'proveedor' | 'aliado'
    targetCompanyId: string
    sourceCompanyId: string
    explanation: string | null
  }> = {},
): Recommendation =>
  Recommendation.create({
    id,
    sourceCompanyId: overrides.sourceCompanyId ?? 'src',
    targetCompanyId: overrides.targetCompanyId ?? 'tgt-1',
    relationType: overrides.relationType ?? 'cliente',
    score: overrides.score ?? 0.7,
    reasons: Reasons.empty(),
    source: 'rule',
    explanation: overrides.explanation ?? null,
  })

describe('GetCompanyRecommendations', () => {
  let recRepo: InMemoryRecommendationRepository
  let companyRepo: InMemoryCompanyRepository
  let useCase: GetCompanyRecommendations

  beforeEach(async () => {
    recRepo = new InMemoryRecommendationRepository()
    companyRepo = new InMemoryCompanyRepository()
    useCase = new GetCompanyRecommendations(recRepo, companyRepo)

    await companyRepo.saveMany([
      company({ id: 'src', ciiu: 'G4631' }),
      company({ id: 'tgt-1', razonSocial: 'Restaurante 1', ciiu: 'I5611' }),
      company({ id: 'tgt-2', razonSocial: 'Restaurante 2', ciiu: 'I5630' }),
    ])
    await recRepo.saveAll([
      rec('r1', {
        targetCompanyId: 'tgt-1',
        relationType: 'cliente',
        score: 0.9,
      }),
      rec('r2', {
        targetCompanyId: 'tgt-2',
        relationType: 'cliente',
        score: 0.7,
      }),
      rec('r3', {
        targetCompanyId: 'tgt-1',
        relationType: 'aliado',
        score: 0.5,
      }),
    ])
  })

  it('returns recommendations sorted by score desc with hydrated target companies', async () => {
    const result = await useCase.execute({ companyId: 'src' })

    expect(result.recommendations.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
    const r1 = result.recommendations[0]
    expect(r1.targetCompany?.id).toBe('tgt-1')
    expect(r1.targetCompany?.razonSocial).toBe('Restaurante 1')
    expect(r1.targetCompany?.ciiu).toBe('5611')
  })

  it('filters by relationType when provided', async () => {
    const result = await useCase.execute({
      companyId: 'src',
      type: 'aliado',
    })

    expect(result.recommendations.map((r) => r.id)).toEqual(['r3'])
  })

  it('respects the limit parameter', async () => {
    const result = await useCase.execute({ companyId: 'src', limit: 1 })
    expect(result.recommendations).toHaveLength(1)
  })

  it('uses the default limit of 10 when not provided', async () => {
    const many = Array.from({ length: 20 }, (_, i) => `extra-${i}`)
    await companyRepo.saveMany(
      many.map((id) => company({ id, razonSocial: id, ciiu: 'I5611' })),
    )
    await recRepo.saveAll(
      many.map((id, i) =>
        rec(`rec-${i}`, {
          targetCompanyId: id,
          relationType: 'cliente',
          score: 0.1 + i * 0.01,
        }),
      ),
    )
    const result = await useCase.execute({ companyId: 'src' })
    expect(result.recommendations).toHaveLength(10)
  })

  it('returns null targetCompany when the target company is missing', async () => {
    await recRepo.saveAll([
      rec('orphan', { targetCompanyId: 'ghost', relationType: 'cliente' }),
    ])
    const result = await useCase.execute({ companyId: 'src' })
    const orphan = result.recommendations.find((r) => r.id === 'orphan')
    expect(orphan).toBeDefined()
    expect(orphan!.targetCompany).toBeNull()
  })

  it('exposes the explanation field for hydrated recs', async () => {
    await recRepo.updateExplanation('r1', 'enriched explanation')
    const result = await useCase.execute({ companyId: 'src' })
    const r1 = result.recommendations.find((r) => r.id === 'r1')
    expect(r1!.explanation).toBe('enriched explanation')
  })

  it('returns empty when company has no recommendations', async () => {
    const result = await useCase.execute({ companyId: 'unknown' })
    expect(result.recommendations).toEqual([])
  })
})
