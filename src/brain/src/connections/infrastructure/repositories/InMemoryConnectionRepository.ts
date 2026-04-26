import { Injectable } from '@nestjs/common'
import { Connection } from '@/connections/domain/entities/Connection'
import type { ConnectionRepository } from '@/connections/domain/repositories/ConnectionRepository'
import type { ConnectionAction } from '@/connections/domain/value-objects/ConnectionAction'

function key(
  userId: string,
  recommendationId: string,
  action: ConnectionAction,
): string {
  return `${userId}|${recommendationId}|${action}`
}

@Injectable()
export class InMemoryConnectionRepository implements ConnectionRepository {
  private readonly store = new Map<string, Connection>()

  async upsert(connection: Connection): Promise<Connection> {
    const k = key(
      connection.userId,
      connection.recommendationId,
      connection.action,
    )
    this.store.set(k, connection)
    return connection
  }

  async findByUser(userId: string): Promise<Connection[]> {
    return Array.from(this.store.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async findByUserAndRecommendation(
    userId: string,
    recommendationId: string,
  ): Promise<Connection[]> {
    return Array.from(this.store.values()).filter(
      (c) => c.userId === userId && c.recommendationId === recommendationId,
    )
  }

  async delete(
    userId: string,
    recommendationId: string,
    action: ConnectionAction,
  ): Promise<void> {
    this.store.delete(key(userId, recommendationId, action))
  }
}
