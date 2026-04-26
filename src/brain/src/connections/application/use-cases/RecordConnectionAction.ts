import { Inject, Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Connection } from '@/connections/domain/entities/Connection'
import {
  CONNECTION_REPOSITORY,
  type ConnectionRepository,
} from '@/connections/domain/repositories/ConnectionRepository'
import type { ConnectionAction } from '@/connections/domain/value-objects/ConnectionAction'
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '@/recommendations/domain/repositories/RecommendationRepository'
import type { UseCase } from '@/shared/domain/UseCase'

export interface RecordConnectionActionInput {
  userId: string
  recommendationId: string
  action: ConnectionAction
  note?: string | null
}

export interface RecordConnectionActionResult {
  connection: Connection
}

@Injectable()
export class RecordConnectionAction implements UseCase<
  RecordConnectionActionInput,
  RecordConnectionActionResult
> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepo: ConnectionRepository,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
  ) {}

  async execute(
    input: RecordConnectionActionInput,
  ): Promise<RecordConnectionActionResult> {
    const rec = await this.recRepo.findById(input.recommendationId)
    if (!rec) {
      throw new Error(`Recommendation not found: ${input.recommendationId}`)
    }

    const connection = Connection.create({
      id: randomUUID(),
      userId: input.userId,
      recommendationId: input.recommendationId,
      action: input.action,
      note: input.note ?? null,
    })

    const persisted = await this.connectionRepo.upsert(connection)
    return { connection: persisted }
  }
}
