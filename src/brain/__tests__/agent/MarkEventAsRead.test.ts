import { beforeEach, describe, expect, it } from 'vitest'
import { MarkEventAsRead } from '@/agent/application/use-cases/MarkEventAsRead'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import { InMemoryAgentEventRepository } from '@/agent/infrastructure/repositories/InMemoryAgentEventRepository'

describe('MarkEventAsRead', () => {
  let repo: InMemoryAgentEventRepository
  let useCase: MarkEventAsRead

  beforeEach(() => {
    repo = new InMemoryAgentEventRepository()
    useCase = new MarkEventAsRead(repo)
  })

  it('marks an existing event as read', async () => {
    await repo.saveAll([
      AgentEvent.create({
        id: 'a',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: {},
        now: new Date('2026-04-26T10:00:00Z'),
      }),
    ])

    await useCase.execute({ eventId: 'a' })

    const events = await repo.findByCompany('c-1')
    expect(events[0]!.read).toBe(true)
  })

  it('is a no-op for unknown id', async () => {
    await expect(
      useCase.execute({ eventId: 'missing' }),
    ).resolves.toBeUndefined()
  })

  it('rejects empty eventId', async () => {
    await expect(useCase.execute({ eventId: '' })).rejects.toThrow(
      /eventId cannot be empty/,
    )
  })
})
