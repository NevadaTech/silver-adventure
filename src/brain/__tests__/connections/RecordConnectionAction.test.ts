import { beforeEach, describe, expect, it } from 'vitest'
import { RecordConnectionAction } from '@/connections/application/use-cases/RecordConnectionAction'
import { InMemoryConnectionRepository } from '@/connections/infrastructure/repositories/InMemoryConnectionRepository'
import { Recommendation } from '@/recommendations/domain/entities/Recommendation'
import { InMemoryRecommendationRepository } from '@/recommendations/infrastructure/repositories/InMemoryRecommendationRepository'
import { Reasons } from '@/recommendations/domain/value-objects/Reason'

const SAMPLE_REC_ID = '00000000-0000-4000-8000-000000000001'

function seedRecRepo(): InMemoryRecommendationRepository {
  const repo = new InMemoryRecommendationRepository()
  repo.saveAll([
    Recommendation.create({
      id: SAMPLE_REC_ID,
      sourceCompanyId: 'comp-a',
      targetCompanyId: 'comp-b',
      relationType: 'aliado',
      score: 0.7,
      reasons: Reasons.empty(),
      source: 'rule',
    }),
  ])
  return repo
}

describe('RecordConnectionAction', () => {
  let connRepo: InMemoryConnectionRepository
  let recRepo: InMemoryRecommendationRepository
  let useCase: RecordConnectionAction

  beforeEach(() => {
    connRepo = new InMemoryConnectionRepository()
    recRepo = seedRecRepo()
    useCase = new RecordConnectionAction(connRepo, recRepo)
  })

  it('persists a new connection for a known recommendation', async () => {
    const { connection } = await useCase.execute({
      userId: 'user-1',
      recommendationId: SAMPLE_REC_ID,
      action: 'saved',
      note: '  recordatorio  ',
    })

    expect(connection.id).toMatch(/[0-9a-f-]{36}/)
    expect(connection.userId).toBe('user-1')
    expect(connection.action).toBe('saved')
    expect(connection.note).toBe('recordatorio')

    const list = await connRepo.findByUser('user-1')
    expect(list).toHaveLength(1)
  })

  it('upserts when the same (user, rec, action) is recorded twice', async () => {
    await useCase.execute({
      userId: 'user-1',
      recommendationId: SAMPLE_REC_ID,
      action: 'marked',
    })
    await useCase.execute({
      userId: 'user-1',
      recommendationId: SAMPLE_REC_ID,
      action: 'marked',
      note: 'voy a contactar',
    })

    const list = await connRepo.findByUser('user-1')
    expect(list).toHaveLength(1)
    expect(list[0].note).toBe('voy a contactar')
  })

  it('throws when the recommendation does not exist', async () => {
    await expect(
      useCase.execute({
        userId: 'user-1',
        recommendationId: 'no-such-rec',
        action: 'saved',
      }),
    ).rejects.toThrow(/Recommendation not found/)
  })
})
