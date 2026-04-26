import { beforeEach, describe, expect, it } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { GetUserConnections } from '@/connections/application/use-cases/GetUserConnections'
import { Connection } from '@/connections/domain/entities/Connection'
import { InMemoryConnectionRepository } from '@/connections/infrastructure/repositories/InMemoryConnectionRepository'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'

describe('GetUserConnections', () => {
  let connRepo: InMemoryConnectionRepository
  let recRepo: InMemoryRecommendationRepository
  let companyRepo: InMemoryCompanyRepository
  let useCase: GetUserConnections

  const REC_ID = '00000000-0000-4000-8000-000000000aa1'

  beforeEach(async () => {
    connRepo = new InMemoryConnectionRepository()
    recRepo = new InMemoryRecommendationRepository()
    companyRepo = new InMemoryCompanyRepository()
    useCase = new GetUserConnections(connRepo, recRepo, companyRepo)

    await companyRepo.saveMany([
      Company.create({
        id: 'comp-target',
        razonSocial: 'Pescaderia La Bahia',
        ciiu: 'A0312',
        municipio: 'SANTA MARTA',
      }),
    ])
    await recRepo.saveAll([
      Recommendation.create({
        id: REC_ID,
        sourceCompanyId: 'comp-source',
        targetCompanyId: 'comp-target',
        relationType: 'proveedor',
        score: 0.81,
        reasons: Reasons.empty(),
        source: 'rule',
      }),
    ])
  })

  it('returns an empty list when the user has no connections', async () => {
    const { connections } = await useCase.execute({ userId: 'no-one' })
    expect(connections).toEqual([])
  })

  it('enriches each connection with rec metadata and target company', async () => {
    await connRepo.upsert(
      Connection.create({
        id: 'c-1',
        userId: 'user-1',
        recommendationId: REC_ID,
        action: 'saved',
        note: 'me interesa',
        createdAt: new Date('2026-04-26T10:00:00Z'),
      }),
    )

    const { connections } = await useCase.execute({ userId: 'user-1' })
    expect(connections).toHaveLength(1)
    expect(connections[0]).toMatchObject({
      id: 'c-1',
      recommendationId: REC_ID,
      action: 'saved',
      note: 'me interesa',
      relationType: 'proveedor',
      score: 0.81,
    })
    expect(connections[0].targetCompany).toMatchObject({
      id: 'comp-target',
      razonSocial: 'Pescaderia La Bahia',
      municipio: 'SANTA MARTA',
    })
  })

  it('returns null target/relation when the rec has been deleted but the connection lingers', async () => {
    await connRepo.upsert(
      Connection.create({
        id: 'c-2',
        userId: 'user-2',
        recommendationId: '00000000-0000-4000-8000-000000000999',
        action: 'simulated_contact',
      }),
    )

    const { connections } = await useCase.execute({ userId: 'user-2' })
    expect(connections).toHaveLength(1)
    expect(connections[0].relationType).toBeNull()
    expect(connections[0].score).toBeNull()
    expect(connections[0].targetCompany).toBeNull()
  })
})
