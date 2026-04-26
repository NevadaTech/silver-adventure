import { Inject, Injectable } from '@nestjs/common'
import { Connection } from '@/connections/domain/entities/Connection'
import type { ConnectionRepository } from '@/connections/domain/repositories/ConnectionRepository'
import {
  isConnectionAction,
  type ConnectionAction,
} from '@/connections/domain/value-objects/ConnectionAction'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'connections'

interface ConnectionRow {
  id: string
  user_id: string
  recommendation_id: string
  action: string
  note: string | null
  created_at: string
}

@Injectable()
export class SupabaseConnectionRepository implements ConnectionRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async upsert(connection: Connection): Promise<Connection> {
    const row = {
      id: connection.id,
      user_id: connection.userId,
      recommendation_id: connection.recommendationId,
      action: connection.action,
      note: connection.note,
      created_at: connection.createdAt.toISOString(),
    }

    const { data, error } = await this.db
      .from(TABLE)
      .upsert(row, { onConflict: 'user_id,recommendation_id,action' })
      .select('*')
      .single()
    if (error) throw error
    return this.toEntity(data as ConnectionRow)
  }

  async findByUser(userId: string): Promise<Connection[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as ConnectionRow[]).map((r) => this.toEntity(r))
  }

  async findByUserAndRecommendation(
    userId: string,
    recommendationId: string,
  ): Promise<Connection[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('recommendation_id', recommendationId)
    if (error) throw error
    return ((data ?? []) as ConnectionRow[]).map((r) => this.toEntity(r))
  }

  async delete(
    userId: string,
    recommendationId: string,
    action: ConnectionAction,
  ): Promise<void> {
    const { error } = await this.db
      .from(TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('recommendation_id', recommendationId)
      .eq('action', action)
    if (error) throw error
  }

  private toEntity(row: ConnectionRow): Connection {
    if (!isConnectionAction(row.action)) {
      throw new Error(`Unknown connection action from DB: ${row.action}`)
    }
    return Connection.create({
      id: row.id,
      userId: row.user_id,
      recommendationId: row.recommendation_id,
      action: row.action,
      note: row.note,
      createdAt: new Date(row.created_at),
    })
  }
}
