import { Entity } from '@/shared/domain/Entity'
import type { ConnectionAction } from '@/connections/domain/value-objects/ConnectionAction'

interface ConnectionProps {
  userId: string
  recommendationId: string
  action: ConnectionAction
  note: string | null
  createdAt: Date
}

export interface CreateConnectionInput {
  id: string
  userId: string
  recommendationId: string
  action: ConnectionAction
  note?: string | null
  createdAt?: Date | null
}

const MAX_NOTE_LENGTH = 280

export class Connection extends Entity<string> {
  private readonly props: ConnectionProps

  private constructor(id: string, props: ConnectionProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(data: CreateConnectionInput): Connection {
    const id = data.id?.trim() ?? ''
    if (id.length === 0) {
      throw new Error('Connection.id cannot be empty')
    }
    const userId = data.userId?.trim() ?? ''
    if (userId.length === 0) {
      throw new Error('Connection.userId cannot be empty')
    }
    const recommendationId = data.recommendationId?.trim() ?? ''
    if (recommendationId.length === 0) {
      throw new Error('Connection.recommendationId cannot be empty')
    }
    const note = data.note?.trim() ?? null
    if (note !== null && note.length > MAX_NOTE_LENGTH) {
      throw new Error(
        `Connection.note must be at most ${MAX_NOTE_LENGTH} characters`,
      )
    }

    return new Connection(id, {
      userId,
      recommendationId,
      action: data.action,
      note: note && note.length > 0 ? note : null,
      createdAt: data.createdAt ?? new Date(),
    })
  }

  get userId(): string {
    return this.props.userId
  }
  get recommendationId(): string {
    return this.props.recommendationId
  }
  get action(): ConnectionAction {
    return this.props.action
  }
  get note(): string | null {
    return this.props.note
  }
  get createdAt(): Date {
    return this.props.createdAt
  }

  matchesKey(
    userId: string,
    recommendationId: string,
    action: ConnectionAction,
  ): boolean {
    return (
      this.props.userId === userId &&
      this.props.recommendationId === recommendationId &&
      this.props.action === action
    )
  }
}
