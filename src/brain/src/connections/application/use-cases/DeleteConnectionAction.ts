import { Inject, Injectable } from '@nestjs/common'
import {
  CONNECTION_REPOSITORY,
  type ConnectionRepository,
} from '@/connections/domain/repositories/ConnectionRepository'
import type { ConnectionAction } from '@/connections/domain/value-objects/ConnectionAction'
import type { UseCase } from '@/shared/domain/UseCase'

export interface DeleteConnectionActionInput {
  userId: string
  recommendationId: string
  action: ConnectionAction
}

@Injectable()
export class DeleteConnectionAction implements UseCase<
  DeleteConnectionActionInput,
  void
> {
  constructor(
    @Inject(CONNECTION_REPOSITORY)
    private readonly connectionRepo: ConnectionRepository,
  ) {}

  async execute(input: DeleteConnectionActionInput): Promise<void> {
    await this.connectionRepo.delete(
      input.userId,
      input.recommendationId,
      input.action,
    )
  }
}
