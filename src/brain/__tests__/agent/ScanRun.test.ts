import { describe, expect, it } from 'vitest'
import { ScanRun } from '@/agent/domain/entities/ScanRun'

const T0 = new Date('2026-04-26T10:00:00Z')
const T1 = new Date('2026-04-26T10:05:00Z')

describe('ScanRun', () => {
  describe('start', () => {
    it('creates a running scan with zeroed stats and the provided startedAt', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })

      expect(run.id).toBe('run-1')
      expect(run.status).toBe('running')
      expect(run.trigger).toBe('cron')
      expect(run.startedAt).toEqual(T0)
      expect(run.completedAt).toBeNull()
      expect(run.errorMessage).toBeNull()
      expect(run.companiesScanned).toBe(0)
      expect(run.clustersGenerated).toBe(0)
      expect(run.recommendationsGenerated).toBe(0)
      expect(run.eventsEmitted).toBe(0)
    })

    it('rejects empty id', () => {
      expect(() =>
        ScanRun.start({ id: '', trigger: 'manual', now: T0 }),
      ).toThrow(/id cannot be empty/)
      expect(() =>
        ScanRun.start({ id: '   ', trigger: 'manual', now: T0 }),
      ).toThrow(/id cannot be empty/)
    })

    it('accepts manual trigger', () => {
      const run = ScanRun.start({ id: 'run-2', trigger: 'manual', now: T0 })
      expect(run.trigger).toBe('manual')
    })
  })

  describe('complete', () => {
    it('returns a new instance with completed status, stats and the provided completedAt', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      const completed = run.complete(
        {
          companiesScanned: 12,
          clustersGenerated: 4,
          recommendationsGenerated: 30,
          eventsEmitted: 5,
        },
        T1,
      )

      expect(completed).not.toBe(run)
      expect(completed.status).toBe('completed')
      expect(completed.completedAt).toEqual(T1)
      expect(completed.companiesScanned).toBe(12)
      expect(completed.clustersGenerated).toBe(4)
      expect(completed.recommendationsGenerated).toBe(30)
      expect(completed.eventsEmitted).toBe(5)
      expect(completed.errorMessage).toBeNull()
    })

    it('preserves the original instance (immutability)', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      run.complete(
        {
          companiesScanned: 1,
          clustersGenerated: 0,
          recommendationsGenerated: 0,
          eventsEmitted: 0,
        },
        T1,
      )
      expect(run.status).toBe('running')
      expect(run.companiesScanned).toBe(0)
    })

    it('rejects negative stats', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      expect(() =>
        run.complete(
          {
            companiesScanned: -1,
            clustersGenerated: 0,
            recommendationsGenerated: 0,
            eventsEmitted: 0,
          },
          T1,
        ),
      ).toThrow(/stats must be non-negative/)
    })
  })

  describe('fail', () => {
    it('returns a new instance with failed status and error message', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      const failed = run.fail('boom', T1)

      expect(failed).not.toBe(run)
      expect(failed.status).toBe('failed')
      expect(failed.completedAt).toEqual(T1)
      expect(failed.errorMessage).toBe('boom')
      expect(failed.companiesScanned).toBe(0)
    })

    it('rejects empty message', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      expect(() => run.fail('', T1)).toThrow(/message cannot be empty/)
      expect(() => run.fail('   ', T1)).toThrow(/message cannot be empty/)
    })
  })

  describe('partial', () => {
    it('returns a new instance with partial status, stats and error message', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      const partial = run.partial(
        {
          companiesScanned: 12,
          clustersGenerated: 4,
          recommendationsGenerated: 30,
          eventsEmitted: 5,
        },
        'gemini timed out, fallback ran',
        T1,
      )

      expect(partial).not.toBe(run)
      expect(partial.status).toBe('partial')
      expect(partial.completedAt).toEqual(T1)
      expect(partial.errorMessage).toBe('gemini timed out, fallback ran')
      expect(partial.companiesScanned).toBe(12)
    })

    it('rejects empty message', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      expect(() =>
        run.partial(
          {
            companiesScanned: 0,
            clustersGenerated: 0,
            recommendationsGenerated: 0,
            eventsEmitted: 0,
          },
          '',
          T1,
        ),
      ).toThrow(/message cannot be empty/)
    })
  })

  describe('durationMs', () => {
    it('returns the elapsed time when completed', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      const t = new Date('2026-04-26T10:00:01.500Z')
      const completed = run.complete(
        {
          companiesScanned: 0,
          clustersGenerated: 0,
          recommendationsGenerated: 0,
          eventsEmitted: 0,
        },
        t,
      )

      expect(completed.durationMs).toBe(1500)
    })

    it('returns null when still running', () => {
      const run = ScanRun.start({ id: 'run-1', trigger: 'cron', now: T0 })
      expect(run.durationMs).toBeNull()
    })
  })

  describe('hydrate', () => {
    it('rebuilds an instance from stored props (used by repository toEntity)', () => {
      const run = ScanRun.hydrate({
        id: 'run-1',
        startedAt: T0,
        completedAt: T1,
        companiesScanned: 12,
        clustersGenerated: 4,
        recommendationsGenerated: 30,
        eventsEmitted: 5,
        status: 'completed',
        trigger: 'cron',
        errorMessage: null,
      })

      expect(run.id).toBe('run-1')
      expect(run.status).toBe('completed')
      expect(run.durationMs).toBe(5 * 60 * 1000)
    })
  })
})
