import { Inject, Injectable } from '@nestjs/common'
import {
  AGENT_EVENT_REPOSITORY,
  type AgentEventRepository,
} from '@/agent/domain/repositories/AgentEventRepository'
import type { UseCase } from '@/shared/domain/UseCase'

export interface MarkEventAsReadInput {
  eventId: string
}

@Injectable()
export class MarkEventAsRead implements UseCase<MarkEventAsReadInput, void> {
  constructor(
    @Inject(AGENT_EVENT_REPOSITORY)
    private readonly repo: AgentEventRepository,
  ) {}

  async execute(input: MarkEventAsReadInput): Promise<void> {
    const eventId = input.eventId?.trim() ?? ''
    if (eventId.length === 0) {
      throw new Error('MarkEventAsRead.eventId cannot be empty')
    }
    await this.repo.markAsRead(eventId)
  }
}
