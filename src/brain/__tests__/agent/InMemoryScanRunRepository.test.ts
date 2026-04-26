import { beforeEach, describe, expect, it } from 'vitest'
import { ScanRun } from '@/agent/domain/entities/ScanRun'
import { InMemoryScanRunRepository } from '@/agent/infrastructure/repositories/InMemoryScanRunRepository'

const T = (iso: string): Date => new Date(iso)

describe('InMemoryScanRunRepository', () => {
  let repo: InMemoryScanRunRepository

  beforeEach(() => {
    repo = new InMemoryScanRunRepository()
  })

  describe('save', () => {
    it('persists a scan run and reflects later updates by id (upsert)', async () => {
      const start = ScanRun.start({
        id: 'run-1',
        trigger: 'cron',
        now: T('2026-04-26T10:00:00Z'),
      })
      await repo.save(start)
      const completed = start.complete(
        {
          companiesScanned: 5,
          clustersGenerated: 1,
          recommendationsGenerated: 3,
          eventsEmitted: 2,
        },
        T('2026-04-26T10:01:00Z'),
      )
      await repo.save(completed)

      const latest = await repo.findLatest()
      expect(latest!.id).toBe('run-1')
      expect(latest!.status).toBe('completed')
      expect(latest!.companiesScanned).toBe(5)
    })
  })

  describe('findLatest', () => {
    it('returns the most recently started run regardless of status', async () => {
      await repo.save(
        ScanRun.start({
          id: 'a',
          trigger: 'cron',
          now: T('2026-04-26T09:00:00Z'),
        }),
      )
      await repo.save(
        ScanRun.start({
          id: 'b',
          trigger: 'manual',
          now: T('2026-04-26T10:00:00Z'),
        }),
      )

      const latest = await repo.findLatest()
      expect(latest!.id).toBe('b')
    })

    it('returns null when no runs exist', async () => {
      expect(await repo.findLatest()).toBeNull()
    })
  })

  describe('findLatestCompleted', () => {
    it('returns the most recently completed run, ignoring running/failed/partial', async () => {
      const a = ScanRun.start({
        id: 'a',
        trigger: 'cron',
        now: T('2026-04-26T09:00:00Z'),
      }).complete(
        {
          companiesScanned: 1,
          clustersGenerated: 0,
          recommendationsGenerated: 0,
          eventsEmitted: 0,
        },
        T('2026-04-26T09:01:00Z'),
      )
      const b = ScanRun.start({
        id: 'b',
        trigger: 'cron',
        now: T('2026-04-26T10:00:00Z'),
      }).complete(
        {
          companiesScanned: 2,
          clustersGenerated: 0,
          recommendationsGenerated: 0,
          eventsEmitted: 0,
        },
        T('2026-04-26T10:01:00Z'),
      )
      const c = ScanRun.start({
        id: 'c',
        trigger: 'cron',
        now: T('2026-04-26T11:00:00Z'),
      })
      const d = ScanRun.start({
        id: 'd',
        trigger: 'cron',
        now: T('2026-04-26T12:00:00Z'),
      }).fail('boom', T('2026-04-26T12:00:30Z'))

      await repo.save(a)
      await repo.save(b)
      await repo.save(c)
      await repo.save(d)

      const latest = await repo.findLatestCompleted()
      expect(latest!.id).toBe('b')
    })

    it('returns null when no completed runs exist', async () => {
      await repo.save(
        ScanRun.start({
          id: 'a',
          trigger: 'cron',
          now: T('2026-04-26T09:00:00Z'),
        }),
      )
      expect(await repo.findLatestCompleted()).toBeNull()
    })
  })

  describe('countByStatus', () => {
    it('counts runs by status', async () => {
      const t = T('2026-04-26T10:00:00Z')
      await repo.save(ScanRun.start({ id: 'a', trigger: 'cron', now: t }))
      await repo.save(
        ScanRun.start({ id: 'b', trigger: 'cron', now: t }).complete(
          {
            companiesScanned: 0,
            clustersGenerated: 0,
            recommendationsGenerated: 0,
            eventsEmitted: 0,
          },
          t,
        ),
      )
      await repo.save(
        ScanRun.start({ id: 'c', trigger: 'cron', now: t }).complete(
          {
            companiesScanned: 0,
            clustersGenerated: 0,
            recommendationsGenerated: 0,
            eventsEmitted: 0,
          },
          t,
        ),
      )
      await repo.save(
        ScanRun.start({ id: 'd', trigger: 'cron', now: t }).fail('boom', t),
      )

      expect(await repo.countByStatus('completed')).toBe(2)
      expect(await repo.countByStatus('running')).toBe(1)
      expect(await repo.countByStatus('failed')).toBe(1)
      expect(await repo.countByStatus('partial')).toBe(0)
    })
  })
})
