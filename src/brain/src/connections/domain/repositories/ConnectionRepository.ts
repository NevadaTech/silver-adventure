import type { Connection } from '@/connections/domain/entities/Connection'
import type { ConnectionAction } from '@/connections/domain/value-objects/ConnectionAction'

export const CONNECTION_REPOSITORY = Symbol('CONNECTION_REPOSITORY')

export interface ConnectionRepository {
  /**
   * Persist a connection. If one already exists for the same
   * (user_id, recommendation_id, action) tuple, it MUST be replaced
   * (upsert semantics) — the API treats the action as idempotent.
   */
  upsert(connection: Connection): Promise<Connection>

  findByUser(userId: string): Promise<Connection[]>

  findByUserAndRecommendation(
    userId: string,
    recommendationId: string,
  ): Promise<Connection[]>

  delete(
    userId: string,
    recommendationId: string,
    action: ConnectionAction,
  ): Promise<void>
}
