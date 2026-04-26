import { Injectable } from '@nestjs/common'
import type { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import type {
  AgentEventRepository,
  FindByCompanyOptions,
} from '@/agent/domain/repositories/AgentEventRepository'

@Injectable()
export class InMemoryAgentEventRepository implements AgentEventRepository {
  private readonly store = new Map<string, AgentEvent>()

  async saveAll(events: AgentEvent[]): Promise<void> {
    for (const e of events) {
      this.store.set(e.id, e)
    }
  }

  async findByCompany(
    companyId: string,
    options?: FindByCompanyOptions,
  ): Promise<AgentEvent[]> {
    const matched = Array.from(this.store.values()).filter(
      (e) => e.companyId === companyId,
    )
    const filtered = options?.unreadOnly
      ? matched.filter((e) => !e.read)
      : matched
    const sorted = filtered.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )
    return options?.limit !== undefined
      ? sorted.slice(0, options.limit)
      : sorted
  }

  async markAsRead(eventId: string): Promise<void> {
    const existing = this.store.get(eventId)
    if (!existing) return
    this.store.set(eventId, existing.markAsRead())
  }

  async countUnreadForCompany(companyId: string): Promise<number> {
    let n = 0
    for (const e of this.store.values()) {
      if (e.companyId === companyId && !e.read) n++
    }
    return n
  }
}
