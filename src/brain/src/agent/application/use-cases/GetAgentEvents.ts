import { Inject, Injectable } from '@nestjs/common'
import type { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import {
  AGENT_EVENT_REPOSITORY,
  type AgentEventRepository,
} from '@/agent/domain/repositories/AgentEventRepository'
import type { UseCase } from '@/shared/domain/UseCase'

export interface GetAgentEventsInput {
  companyId: string
  unreadOnly?: boolean
  limit?: number
}

export interface GetAgentEventsOutput {
  events: AgentEvent[]
}

@Injectable()
export class GetAgentEvents implements UseCase<
  GetAgentEventsInput,
  GetAgentEventsOutput
> {
  constructor(
    @Inject(AGENT_EVENT_REPOSITORY)
    private readonly repo: AgentEventRepository,
  ) {}

  async execute(input: GetAgentEventsInput): Promise<GetAgentEventsOutput> {
    const companyId = input.companyId?.trim() ?? ''
    if (companyId.length === 0) {
      throw new Error('GetAgentEvents.companyId cannot be empty')
    }
    const events = await this.repo.findByCompany(companyId, {
      unreadOnly: input.unreadOnly,
      limit: input.limit,
    })
    return { events }
  }
}
