import { beforeEach, describe, expect, it } from 'vitest'
import { GetAgentEvents } from '@/agent/application/use-cases/GetAgentEvents'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import { InMemoryAgentEventRepository } from '@/agent/infrastructure/repositories/InMemoryAgentEventRepository'

const T = (iso: string): Date => new Date(iso)

describe('GetAgentEvents', () => {
  let repo: InMemoryAgentEventRepository
  let useCase: GetAgentEvents

  beforeEach(() => {
    repo = new InMemoryAgentEventRepository()
    useCase = new GetAgentEvents(repo)
  })

  it('returns events for a company sorted by createdAt desc', async () => {
    await repo.saveAll([
      AgentEvent.create({
        id: 'a',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: {},
        now: T('2026-04-26T09:00:00Z'),
      }),
      AgentEvent.create({
        id: 'b',
        companyId: 'c-1',
        eventType: 'new_cluster_member',
        payload: {},
        now: T('2026-04-26T11:00:00Z'),
      }),
    ])

    const result = await useCase.execute({ companyId: 'c-1' })
    expect(result.events.map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('forwards unreadOnly and limit options to the repo', async () => {
    const read = AgentEvent.create({
      id: 'a',
      companyId: 'c-1',
      eventType: 'new_high_score_match',
      payload: {},
      now: T('2026-04-26T09:00:00Z'),
    }).markAsRead()
    await repo.saveAll([
      read,
      AgentEvent.create({
        id: 'b',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: {},
        now: T('2026-04-26T10:00:00Z'),
      }),
      AgentEvent.create({
        id: 'c',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: {},
        now: T('2026-04-26T11:00:00Z'),
      }),
    ])

    const result = await useCase.execute({
      companyId: 'c-1',
      unreadOnly: true,
      limit: 1,
    })

    expect(result.events.map((e) => e.id)).toEqual(['c'])
  })

  it('returns empty when company has no events', async () => {
    const result = await useCase.execute({ companyId: 'nope' })
    expect(result.events).toEqual([])
  })

  it('rejects empty companyId', async () => {
    await expect(useCase.execute({ companyId: '' })).rejects.toThrow(
      /companyId cannot be empty/,
    )
    await expect(useCase.execute({ companyId: '   ' })).rejects.toThrow(
      /companyId cannot be empty/,
    )
  })
})
