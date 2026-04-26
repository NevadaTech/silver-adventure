import type { AgentEvent } from '@/agent/domain/entities/AgentEvent'

export const AGENT_EVENT_REPOSITORY = Symbol('AGENT_EVENT_REPOSITORY')

export interface FindByCompanyOptions {
  unreadOnly?: boolean
  limit?: number
}

export interface AgentEventRepository {
  saveAll(events: AgentEvent[]): Promise<void>
  findByCompany(
    companyId: string,
    options?: FindByCompanyOptions,
  ): Promise<AgentEvent[]>
  markAsRead(eventId: string): Promise<void>
  countUnreadForCompany(companyId: string): Promise<number>
}
