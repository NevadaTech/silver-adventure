import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScanRun } from '@/agent/domain/entities/ScanRun'
import { SupabaseScanRunRepository } from '@/agent/infrastructure/repositories/SupabaseScanRunRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    upsert: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
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
    'order',
    'limit',
  ] as const) {
    builder[fn].mockReturnValue(builder)
  }
  builder.maybeSingle.mockImplementation(() => Promise.resolve(resolved))

  return {
    db: builder as unknown as BrainSupabaseClient,
    setNext: (value: Resolved) => {
      resolved = value
    },
    spies: builder,
  }
}

const validRow = {
  id: 'run-1',
  started_at: '2026-04-26T10:00:00Z',
  completed_at: '2026-04-26T10:01:00Z',
  companies_scanned: 5,
  clusters_generated: 1,
  recommendations_generated: 3,
  events_emitted: 2,
  status: 'completed',
  trigger: 'cron',
  error_message: null,
  duration_ms: 60000,
}

describe('SupabaseScanRunRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseScanRunRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseScanRunRepository(fake.db)
  })

  describe('save', () => {
    it('upserts the row including computed duration_ms when completed', async () => {
      fake.setNext({ data: null, error: null })
      const run = ScanRun.start({
        id: 'run-1',
        trigger: 'cron',
        now: new Date('2026-04-26T10:00:00Z'),
      }).complete(
        {
          companiesScanned: 5,
          clustersGenerated: 1,
          recommendationsGenerated: 3,
          eventsEmitted: 2,
        },
        new Date('2026-04-26T10:01:00Z'),
      )

      await repo.save(run)

      expect(fake.spies.from).toHaveBeenCalledWith('scan_runs')
      expect(fake.spies.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-1',
          status: 'completed',
          trigger: 'cron',
          started_at: '2026-04-26T10:00:00.000Z',
          completed_at: '2026-04-26T10:01:00.000Z',
          companies_scanned: 5,
          clusters_generated: 1,
          recommendations_generated: 3,
          events_emitted: 2,
          duration_ms: 60000,
          error_message: null,
        }),
        { onConflict: 'id' },
      )
    })

    it('persists null completed_at and null duration_ms when running', async () => {
      fake.setNext({ data: null, error: null })
      const run = ScanRun.start({
        id: 'run-1',
        trigger: 'cron',
        now: new Date('2026-04-26T10:00:00Z'),
      })

      await repo.save(run)

      expect(fake.spies.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'running',
          completed_at: null,
          duration_ms: null,
        }),
        { onConflict: 'id' },
      )
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      const run = ScanRun.start({
        id: 'run-1',
        trigger: 'cron',
        now: new Date('2026-04-26T10:00:00Z'),
      })
      await expect(repo.save(run)).rejects.toThrow(/boom/)
    })
  })

  describe('findLatest', () => {
    it('selects latest by started_at desc with limit 1', async () => {
      fake.setNext({ data: validRow, error: null })
      const run = await repo.findLatest()

      expect(fake.spies.from).toHaveBeenCalledWith('scan_runs')
      expect(fake.spies.order).toHaveBeenCalledWith('started_at', {
        ascending: false,
      })
      expect(fake.spies.limit).toHaveBeenCalledWith(1)
      expect(run!.id).toBe('run-1')
      expect(run!.status).toBe('completed')
    })

    it('returns null when row missing', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findLatest()).toBeNull()
    })

    it('throws on error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.findLatest()).rejects.toThrow(/boom/)
    })

    it('throws when row status is unknown', async () => {
      fake.setNext({ data: { ...validRow, status: 'wat' }, error: null })
      await expect(repo.findLatest()).rejects.toThrow(/Unknown ScanRun status/)
    })

    it('throws when row trigger is unknown', async () => {
      fake.setNext({ data: { ...validRow, trigger: 'wat' }, error: null })
      await expect(repo.findLatest()).rejects.toThrow(/Unknown ScanRun trigger/)
    })
  })

  describe('findLatestCompleted', () => {
    it('filters by status=completed and orders by completed_at desc', async () => {
      fake.setNext({ data: validRow, error: null })
      const run = await repo.findLatestCompleted()

      expect(fake.spies.eq).toHaveBeenCalledWith('status', 'completed')
      expect(fake.spies.order).toHaveBeenCalledWith('completed_at', {
        ascending: false,
      })
      expect(fake.spies.limit).toHaveBeenCalledWith(1)
      expect(run!.id).toBe('run-1')
    })

    it('returns null when none completed', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findLatestCompleted()).toBeNull()
    })
  })

  describe('countByStatus', () => {
    it('uses count exact head true and filters by status', async () => {
      fake.setNext({ data: null, error: null, count: 7 })
      const n = await repo.countByStatus('completed')

      expect(n).toBe(7)
      expect(fake.spies.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      })
      expect(fake.spies.eq).toHaveBeenCalledWith('status', 'completed')
    })

    it('returns 0 when count is null', async () => {
      fake.setNext({ data: null, error: null, count: null })
      expect(await repo.countByStatus('failed')).toBe(0)
    })
  })
})
