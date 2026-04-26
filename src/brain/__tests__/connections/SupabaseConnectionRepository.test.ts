import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Connection } from '@/connections/domain/entities/Connection'
import { SupabaseConnectionRepository } from '@/connections/infrastructure/repositories/SupabaseConnectionRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
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
    'delete',
    'order',
  ] as const) {
    builder[fn].mockReturnValue(builder)
  }
  builder.single.mockImplementation(() => Promise.resolve(resolved))

  return {
    db: builder as unknown as BrainSupabaseClient,
    setNext: (value: Resolved) => {
      resolved = value
    },
    spies: builder,
  }
}

const validRow = {
  id: 'conn-1',
  user_id: 'u-1',
  recommendation_id: 'rec-1',
  action: 'saved',
  note: null as string | null,
  created_at: '2026-04-26T10:00:00.000Z',
}

describe('SupabaseConnectionRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseConnectionRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseConnectionRepository(fake.db)
  })

  describe('upsert', () => {
    it('upserts with the (user_id, recommendation_id, action) onConflict tuple', async () => {
      fake.setNext({ data: validRow, error: null })

      const c = Connection.create({
        id: 'conn-1',
        userId: 'u-1',
        recommendationId: 'rec-1',
        action: 'saved',
      })
      const result = await repo.upsert(c)

      expect(fake.spies.from).toHaveBeenCalledWith('connections')
      expect(fake.spies.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conn-1',
          user_id: 'u-1',
          recommendation_id: 'rec-1',
          action: 'saved',
        }),
        { onConflict: 'user_id,recommendation_id,action' },
      )
      expect(result).toBeInstanceOf(Connection)
    })

    it('throws when supabase returns an error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      const c = Connection.create({
        id: 'conn-1',
        userId: 'u-1',
        recommendationId: 'rec-1',
        action: 'saved',
      })
      await expect(repo.upsert(c)).rejects.toThrow(/boom/)
    })
  })

  describe('findByUser', () => {
    it('filters by user_id and orders by created_at desc', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findByUser('u-1')

      expect(fake.spies.eq).toHaveBeenCalledWith('user_id', 'u-1')
      expect(fake.spies.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toBeInstanceOf(Connection)
    })

    it('throws on a row with an unknown action', async () => {
      fake.setNext({
        data: [{ ...validRow, action: 'wat' }],
        error: null,
      })
      await expect(repo.findByUser('u-1')).rejects.toThrow(
        /Unknown connection action/,
      )
    })
  })

  describe('delete', () => {
    it('issues a delete scoped to (user_id, recommendation_id, action)', async () => {
      fake.setNext({ data: null, error: null })
      await repo.delete('u-1', 'rec-1', 'saved')

      expect(fake.spies.delete).toHaveBeenCalled()
      expect(fake.spies.eq).toHaveBeenCalledWith('user_id', 'u-1')
      expect(fake.spies.eq).toHaveBeenCalledWith('recommendation_id', 'rec-1')
      expect(fake.spies.eq).toHaveBeenCalledWith('action', 'saved')
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.delete('u-1', 'rec-1', 'saved')).rejects.toThrow(/boom/)
    })
  })
})
