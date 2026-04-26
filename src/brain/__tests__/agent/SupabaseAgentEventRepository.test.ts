import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import { SupabaseAgentEventRepository } from '@/agent/infrastructure/repositories/SupabaseAgentEventRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of [
    'from',
    'select',
    'eq',
    'upsert',
    'update',
    'order',
    'limit',
  ] as const) {
    builder[fn].mockReturnValue(builder)
  }

  return {
    db: builder as unknown as BrainSupabaseClient,
    setNext: (value: Resolved) => {
      resolved = value
    },
    spies: builder,
  }
}

const validRow = {
  id: 'ev-1',
  company_id: 'c-1',
  event_type: 'new_high_score_match',
  payload: { score: 0.9 },
  read: false,
  created_at: '2026-04-26T10:00:00Z',
}

describe('SupabaseAgentEventRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseAgentEventRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseAgentEventRepository(fake.db)
  })

  describe('saveAll', () => {
    it('upserts rows with onConflict id', async () => {
      fake.setNext({ data: null, error: null })
      const ev = AgentEvent.create({
        id: 'ev-1',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: { score: 0.9 },
        now: new Date('2026-04-26T10:00:00Z'),
      })

      await repo.saveAll([ev])

      expect(fake.spies.from).toHaveBeenCalledWith('agent_events')
      expect(fake.spies.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ev-1',
            company_id: 'c-1',
            event_type: 'new_high_score_match',
            payload: { score: 0.9 },
            read: false,
            created_at: '2026-04-26T10:00:00.000Z',
          }),
        ]),
        { onConflict: 'id' },
      )
    })

    it('is a no-op for empty array', async () => {
      await repo.saveAll([])
      expect(fake.spies.upsert).not.toHaveBeenCalled()
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      const ev = AgentEvent.create({
        id: 'ev-1',
        companyId: 'c-1',
        eventType: 'new_cluster_member',
        payload: {},
        now: new Date('2026-04-26T10:00:00Z'),
      })
      await expect(repo.saveAll([ev])).rejects.toThrow(/boom/)
    })
  })

  describe('findByCompany', () => {
    it('filters by company_id and orders by created_at desc', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findByCompany('c-1')

      expect(fake.spies.from).toHaveBeenCalledWith('agent_events')
      expect(fake.spies.eq).toHaveBeenCalledWith('company_id', 'c-1')
      expect(fake.spies.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      })
      expect(fake.spies.limit).not.toHaveBeenCalled()
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('ev-1')
    })

    it('with unreadOnly=true filters read=false', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.findByCompany('c-1', { unreadOnly: true })

      expect(fake.spies.eq).toHaveBeenCalledWith('read', false)
    })

    it('applies limit when provided', async () => {
      fake.setNext({ data: [], error: null })
      await repo.findByCompany('c-1', { limit: 5 })
      expect(fake.spies.limit).toHaveBeenCalledWith(5)
    })

    it('throws when row event_type is unknown', async () => {
      fake.setNext({
        data: [{ ...validRow, event_type: 'wat' }],
        error: null,
      })
      await expect(repo.findByCompany('c-1')).rejects.toThrow(
        /Unknown agent_event event_type/,
      )
    })

    it('returns [] when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findByCompany('c-1')).toEqual([])
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.findByCompany('c-1')).rejects.toThrow(/boom/)
    })
  })

  describe('markAsRead', () => {
    it('updates read=true filtered by id', async () => {
      fake.setNext({ data: null, error: null })
      await repo.markAsRead('ev-1')

      expect(fake.spies.update).toHaveBeenCalledWith({ read: true })
      expect(fake.spies.eq).toHaveBeenCalledWith('id', 'ev-1')
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.markAsRead('ev-1')).rejects.toThrow(/boom/)
    })
  })

  describe('countUnreadForCompany', () => {
    it('counts events with read=false for the company', async () => {
      fake.setNext({ data: null, error: null, count: 3 })
      const n = await repo.countUnreadForCompany('c-1')

      expect(n).toBe(3)
      expect(fake.spies.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      })
      expect(fake.spies.eq).toHaveBeenCalledWith('company_id', 'c-1')
      expect(fake.spies.eq).toHaveBeenCalledWith('read', false)
    })

    it('returns 0 when count is null', async () => {
      fake.setNext({ data: null, error: null, count: null })
      expect(await repo.countUnreadForCompany('c-1')).toBe(0)
    })
  })
})
