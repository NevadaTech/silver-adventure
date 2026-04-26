import { Inject, Injectable } from '@nestjs/common'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import type {
  AgentEventRepository,
  FindByCompanyOptions,
} from '@/agent/domain/repositories/AgentEventRepository'
import {
  isEventType,
  type EventType,
} from '@/agent/domain/value-objects/EventType'
import type { Json } from '@/shared/infrastructure/supabase/database.types'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'agent_events'
const CHUNK_SIZE = 500

interface AgentEventRow {
  id: string
  company_id: string
  event_type: string
  payload: Json
  read: boolean
  created_at: string
}

@Injectable()
export class SupabaseAgentEventRepository implements AgentEventRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async saveAll(events: AgentEvent[]): Promise<void> {
    if (events.length === 0) return
    const rows = events.map((e) => this.toRow(e))
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await this.db
        .from(TABLE)
        .upsert(chunk, { onConflict: 'id' })
      if (error) throw error
    }
  }

  async findByCompany(
    companyId: string,
    options?: FindByCompanyOptions,
  ): Promise<AgentEvent[]> {
    let query = this.db
      .from(TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    if (options?.unreadOnly) {
      query = query.eq('read', false)
    }
    if (options?.limit !== undefined) {
      query = query.limit(options.limit)
    }
    const { data, error } = await query
    if (error) throw error
    return ((data ?? []) as AgentEventRow[]).map((r) => this.toEntity(r))
  }

  async markAsRead(eventId: string): Promise<void> {
    const { error } = await this.db
      .from(TABLE)
      .update({ read: true })
      .eq('id', eventId)
    if (error) throw error
  }

  async countUnreadForCompany(companyId: string): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('read', false)
    if (error) throw error
    return count ?? 0
  }

  private toRow(e: AgentEvent): AgentEventRow {
    return {
      id: e.id,
      company_id: e.companyId,
      event_type: e.eventType,
      payload: e.payload as unknown as Json,
      read: e.read,
      created_at: e.createdAt.toISOString(),
    }
  }

  private toEntity(row: AgentEventRow): AgentEvent {
    if (!isEventType(row.event_type)) {
      throw new Error(
        `Unknown agent_event event_type from DB: ${row.event_type}`,
      )
    }
    return AgentEvent.hydrate({
      id: row.id,
      companyId: row.company_id,
      eventType: row.event_type as EventType,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      read: row.read,
      createdAt: new Date(row.created_at),
    })
  }
}
