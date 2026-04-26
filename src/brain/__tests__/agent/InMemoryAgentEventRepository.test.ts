import { beforeEach, describe, expect, it } from 'vitest'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import { InMemoryAgentEventRepository } from '@/agent/infrastructure/repositories/InMemoryAgentEventRepository'

const T = (iso: string): Date => new Date(iso)

const makeEvent = (
  overrides: Partial<{
    id: string
    companyId: string
    eventType:
      | 'new_high_score_match'
      | 'new_value_chain_partner'
      | 'new_cluster_member'
    payload: Record<string, unknown>
    now: Date
  }> = {},
): AgentEvent =>
  AgentEvent.create({
    id: 'ev-1',
    companyId: 'c-1',
    eventType: 'new_high_score_match',
    payload: { score: 0.9 },
    now: T('2026-04-26T10:00:00Z'),
    ...overrides,
  })

describe('InMemoryAgentEventRepository', () => {
  let repo: InMemoryAgentEventRepository

  beforeEach(() => {
    repo = new InMemoryAgentEventRepository()
  })

  describe('saveAll', () => {
    it('persists every event keyed by id', async () => {
      await repo.saveAll([
        makeEvent({ id: 'a' }),
        makeEvent({ id: 'b', companyId: 'c-2' }),
      ])
      const result = await repo.findByCompany('c-1')
      expect(result.map((e) => e.id)).toEqual(['a'])
    })

    it('upserts when the same id is saved twice', async () => {
      await repo.saveAll([makeEvent({ id: 'a' })])
      const updated = makeEvent({ id: 'a' }).markAsRead()
      await repo.saveAll([updated])
      const result = await repo.findByCompany('c-1')
      expect(result[0]!.read).toBe(true)
    })

    it('is a no-op for empty array', async () => {
      await repo.saveAll([])
      expect(await repo.countUnreadForCompany('c-1')).toBe(0)
    })
  })

  describe('findByCompany', () => {
    it('returns events for a company sorted by createdAt desc', async () => {
      await repo.saveAll([
        makeEvent({ id: 'a', now: T('2026-04-26T09:00:00Z') }),
        makeEvent({ id: 'b', now: T('2026-04-26T11:00:00Z') }),
        makeEvent({ id: 'c', now: T('2026-04-26T10:00:00Z') }),
      ])
      const result = await repo.findByCompany('c-1')
      expect(result.map((e) => e.id)).toEqual(['b', 'c', 'a'])
    })

    it('filters out other companies', async () => {
      await repo.saveAll([
        makeEvent({ id: 'a', companyId: 'c-1' }),
        makeEvent({ id: 'b', companyId: 'c-2' }),
      ])
      expect(await repo.findByCompany('c-2')).toHaveLength(1)
    })

    it('with unreadOnly=true filters out events already read', async () => {
      const a = makeEvent({ id: 'a' }).markAsRead()
      const b = makeEvent({ id: 'b' })
      await repo.saveAll([a, b])
      const result = await repo.findByCompany('c-1', { unreadOnly: true })
      expect(result.map((e) => e.id)).toEqual(['b'])
    })

    it('respects limit', async () => {
      await repo.saveAll([
        makeEvent({ id: 'a', now: T('2026-04-26T09:00:00Z') }),
        makeEvent({ id: 'b', now: T('2026-04-26T10:00:00Z') }),
        makeEvent({ id: 'c', now: T('2026-04-26T11:00:00Z') }),
      ])
      const result = await repo.findByCompany('c-1', { limit: 2 })
      expect(result).toHaveLength(2)
      expect(result.map((e) => e.id)).toEqual(['c', 'b'])
    })

    it('returns empty when no events', async () => {
      expect(await repo.findByCompany('nope')).toEqual([])
    })
  })

  describe('markAsRead', () => {
    it('flips an unread event to read', async () => {
      await repo.saveAll([makeEvent({ id: 'a' })])
      await repo.markAsRead('a')
      const result = await repo.findByCompany('c-1')
      expect(result[0]!.read).toBe(true)
    })

    it('is a no-op for unknown id', async () => {
      await expect(repo.markAsRead('missing')).resolves.toBeUndefined()
    })
  })

  describe('countUnreadForCompany', () => {
    it('counts only unread events for the company', async () => {
      const read = makeEvent({ id: 'a' }).markAsRead()
      await repo.saveAll([
        read,
        makeEvent({ id: 'b' }),
        makeEvent({ id: 'c' }),
        makeEvent({ id: 'd', companyId: 'other' }),
      ])
      expect(await repo.countUnreadForCompany('c-1')).toBe(2)
    })

    it('returns 0 when no events', async () => {
      expect(await repo.countUnreadForCompany('c-1')).toBe(0)
    })
  })
})
