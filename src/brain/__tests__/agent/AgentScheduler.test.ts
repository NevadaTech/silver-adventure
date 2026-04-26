import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infrastructure/env', () => ({
  env: {
    AGENT_CRON_SCHEDULE: '*/60 * * * * *',
    AGENT_ENABLED: 'true',
  },
}))

import { env } from '@/shared/infrastructure/env'
import { AgentScheduler } from '@/agent/infrastructure/scheduler/AgentScheduler'
import type { RunIncrementalScan } from '@/agent/application/use-cases/RunIncrementalScan'

const stubRunScan = (): {
  scheduler: AgentScheduler
  runScan: { execute: ReturnType<typeof vi.fn> }
} => {
  const runScan = {
    execute: vi.fn(async () => ({
      runId: 'run-1',
      status: 'completed' as const,
      companiesScanned: 1,
      clustersGenerated: 1,
      recommendationsGenerated: 1,
      eventsEmitted: 0,
    })),
  }
  return {
    scheduler: new AgentScheduler(runScan as unknown as RunIncrementalScan),
    runScan,
  }
}

describe('AgentScheduler', () => {
  beforeEach(() => {
    ;(env as { AGENT_ENABLED: string }).AGENT_ENABLED = 'true'
  })

  describe('handleScan', () => {
    it('runs the incremental scan with trigger=cron when enabled', async () => {
      const { scheduler, runScan } = stubRunScan()
      await scheduler.handleScan()

      expect(runScan.execute).toHaveBeenCalledWith({ trigger: 'cron' })
    })

    it('does nothing when AGENT_ENABLED is "false"', async () => {
      ;(env as { AGENT_ENABLED: string }).AGENT_ENABLED = 'false'
      const { scheduler, runScan } = stubRunScan()
      await scheduler.handleScan()

      expect(runScan.execute).not.toHaveBeenCalled()
    })

    it('skips when a previous run is still in progress (re-entry guard)', async () => {
      const { scheduler, runScan } = stubRunScan()
      let resolveFirst!: () => void
      runScan.execute.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = () =>
              resolve({
                runId: 'run-1',
                status: 'completed',
                companiesScanned: 0,
                clustersGenerated: 0,
                recommendationsGenerated: 0,
                eventsEmitted: 0,
              })
          }),
      )

      const first = scheduler.handleScan()
      // While first is still pending, fire a second tick
      const second = scheduler.handleScan()
      await second // returns immediately because first is still running

      expect(runScan.execute).toHaveBeenCalledTimes(1)

      resolveFirst()
      await first
    })

    it('catches errors from runScan and does not rethrow', async () => {
      const { scheduler, runScan } = stubRunScan()
      runScan.execute.mockRejectedValueOnce(new Error('scan blew up'))

      await expect(scheduler.handleScan()).resolves.toBeUndefined()
    })

    it('clears the running flag after success so the next tick can run', async () => {
      const { scheduler, runScan } = stubRunScan()
      await scheduler.handleScan()
      await scheduler.handleScan()

      expect(runScan.execute).toHaveBeenCalledTimes(2)
    })

    it('clears the running flag after failure so the next tick can run', async () => {
      const { scheduler, runScan } = stubRunScan()
      runScan.execute.mockRejectedValueOnce(new Error('first one fails'))

      await scheduler.handleScan()
      await scheduler.handleScan()

      expect(runScan.execute).toHaveBeenCalledTimes(2)
    })
  })
})
