import { Entity } from '@/shared/domain/Entity'
import type { EventType } from '@/agent/domain/value-objects/EventType'

interface AgentEventProps {
  companyId: string
  eventType: EventType
  payload: Record<string, unknown>
  read: boolean
  createdAt: Date
}

export interface CreateAgentEventInput {
  id: string
  companyId: string
  eventType: EventType
  payload: Record<string, unknown>
  now: Date
}

export interface HydrateAgentEventInput extends AgentEventProps {
  id: string
}

export class AgentEvent extends Entity<string> {
  private readonly props: AgentEventProps

  private constructor(id: string, props: AgentEventProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(input: CreateAgentEventInput): AgentEvent {
    const id = input.id?.trim() ?? ''
    if (id.length === 0) {
      throw new Error('AgentEvent.id cannot be empty')
    }
    const companyId = input.companyId?.trim() ?? ''
    if (companyId.length === 0) {
      throw new Error('AgentEvent.companyId cannot be empty')
    }
    return new AgentEvent(id, {
      companyId,
      eventType: input.eventType,
      payload: input.payload,
      read: false,
      createdAt: input.now,
    })
  }

  static hydrate(input: HydrateAgentEventInput): AgentEvent {
    const id = input.id?.trim() ?? ''
    if (id.length === 0) {
      throw new Error('AgentEvent.id cannot be empty')
    }
    const { id: _id, ...props } = input
    return new AgentEvent(id, props)
  }

  markAsRead(): AgentEvent {
    return new AgentEvent(this.id, { ...this.props, read: true })
  }

  get companyId(): string {
    return this.props.companyId
  }
  get eventType(): EventType {
    return this.props.eventType
  }
  get payload(): Record<string, unknown> {
    return this.props.payload
  }
  get read(): boolean {
    return this.props.read
  }
  get createdAt(): Date {
    return this.props.createdAt
  }
}
