import { beforeEach, describe, expect, it } from 'vitest'
import {
  Company,
  type CreateCompanyInput,
} from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { GetCompanyRecommendations } from '@/recommendations/application/use-cases/GetCompanyRecommendations'
import { GetGroupedCompanyRecommendations } from '@/recommendations/application/use-cases/GetGroupedCompanyRecommendations'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
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
    relationType: RelationType
    targetCompanyId: string
    sourceCompanyId: string
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
  })

describe('GetGroupedCompanyRecommendations', () => {
  let recRepo: InMemoryRecommendationRepository
  let companyRepo: InMemoryCompanyRepository
  let useCase: GetGroupedCompanyRecommendations

  beforeEach(async () => {
    recRepo = new InMemoryRecommendationRepository()
    companyRepo = new InMemoryCompanyRepository()
    useCase = new GetGroupedCompanyRecommendations(
      new GetCompanyRecommendations(recRepo, companyRepo),
    )

    await companyRepo.saveMany([
      company({ id: 'src' }),
      company({ id: 'p1', razonSocial: 'Proveedor 1', ciiu: 'I5611' }),
      company({ id: 'p2', razonSocial: 'Proveedor 2', ciiu: 'I5611' }),
      company({ id: 'p3', razonSocial: 'Proveedor 3', ciiu: 'I5611' }),
      company({ id: 'p4', razonSocial: 'Proveedor 4', ciiu: 'I5611' }),
      company({ id: 'c1', razonSocial: 'Cliente 1', ciiu: 'G4711' }),
      company({ id: 'c2', razonSocial: 'Cliente 2', ciiu: 'G4711' }),
      company({ id: 'a1', razonSocial: 'Aliado 1', ciiu: 'I5611' }),
      company({ id: 'r1', razonSocial: 'Referente 1', ciiu: 'I5611' }),
      company({ id: 'r2', razonSocial: 'Referente 2', ciiu: 'I5611' }),
      company({ id: 'r3', razonSocial: 'Referente 3', ciiu: 'I5611' }),
    ])
  })

  it('returns recommendations grouped by relation type', async () => {
    await recRepo.saveAll([
      rec('rp1', {
        targetCompanyId: 'p1',
        relationType: 'proveedor',
        score: 0.9,
      }),
      rec('rp2', {
        targetCompanyId: 'p2',
        relationType: 'proveedor',
        score: 0.8,
      }),
      rec('rp3', {
        targetCompanyId: 'p3',
        relationType: 'proveedor',
        score: 0.7,
      }),
      rec('rc1', {
        targetCompanyId: 'c1',
        relationType: 'cliente',
        score: 0.95,
      }),
      rec('rc2', {
        targetCompanyId: 'c2',
        relationType: 'cliente',
        score: 0.85,
      }),
      rec('ra1', {
        targetCompanyId: 'a1',
        relationType: 'aliado',
        score: 0.6,
      }),
      rec('rr1', {
        targetCompanyId: 'r1',
        relationType: 'referente',
        score: 0.5,
      }),
      rec('rr2', {
        targetCompanyId: 'r2',
        relationType: 'referente',
        score: 0.4,
      }),
      rec('rr3', {
        targetCompanyId: 'r3',
        relationType: 'referente',
        score: 0.3,
      }),
    ])

    const result = await useCase.execute({ companyId: 'src' })

    expect(result.proveedor.map((r) => r.id)).toEqual(['rp1', 'rp2', 'rp3'])
    expect(result.cliente.map((r) => r.id)).toEqual(['rc1', 'rc2'])
    expect(result.aliado.map((r) => r.id)).toEqual(['ra1'])
    expect(result.referente.map((r) => r.id)).toEqual(['rr1', 'rr2', 'rr3'])
  })

  it('caps each relation type at 10 items', async () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      rec(`rec-${i}`, {
        targetCompanyId: `p${i}`,
        relationType: 'proveedor',
        score: 0.1 + i * 0.01,
      }),
    )
    await companyRepo.saveMany(
      Array.from({ length: 15 }, (_, i) =>
        company({ id: `p${i}`, ciiu: 'I5611' }),
      ),
    )
    await recRepo.saveAll(many)

    const result = await useCase.execute({ companyId: 'src' })
    expect(result.proveedor).toHaveLength(10)
    expect(result.cliente).toHaveLength(0)
  })

  it('flags partial=true when any relation type has fewer than 3 recommendations', async () => {
    await recRepo.saveAll([
      rec('rp1', {
        targetCompanyId: 'p1',
        relationType: 'proveedor',
        score: 0.9,
      }),
      rec('rp2', {
        targetCompanyId: 'p2',
        relationType: 'proveedor',
        score: 0.8,
      }),
      rec('rp3', {
        targetCompanyId: 'p3',
        relationType: 'proveedor',
        score: 0.7,
      }),
      rec('rc1', {
        targetCompanyId: 'c1',
        relationType: 'cliente',
        score: 0.95,
      }),
    ])

    const result = await useCase.execute({ companyId: 'src' })
    expect(result.partial).toBe(true)
    expect(result.cliente).toHaveLength(1)
  })

  it('flags partial=false when every relation type has at least 3', async () => {
    const recs: Recommendation[] = []
    const types: RelationType[] = [
      'proveedor',
      'cliente',
      'aliado',
      'referente',
    ]
    const targets: Record<RelationType, string[]> = {
      proveedor: ['p1', 'p2', 'p3'],
      cliente: ['c1', 'c2', 'r1'],
      aliado: ['a1', 'r2', 'r3'],
      referente: ['p4', 'p1', 'p2'],
    }
    for (const t of types) {
      for (const tgt of targets[t]) {
        recs.push(
          rec(`${t}-${tgt}`, {
            targetCompanyId: tgt,
            relationType: t,
            score: 0.5,
          }),
        )
      }
    }
    await recRepo.saveAll(recs)

    const result = await useCase.execute({ companyId: 'src' })
    expect(result.partial).toBe(false)
  })

  it('returns empty arrays and partial=true when no recommendations exist', async () => {
    const result = await useCase.execute({ companyId: 'unknown' })
    expect(result.proveedor).toEqual([])
    expect(result.cliente).toEqual([])
    expect(result.aliado).toEqual([])
    expect(result.referente).toEqual([])
    expect(result.partial).toBe(true)
  })
})
