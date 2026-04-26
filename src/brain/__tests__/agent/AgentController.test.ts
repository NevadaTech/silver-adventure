import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentController } from '@/agent/infrastructure/http/agent.controller'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import { ScanRun } from '@/agent/domain/entities/ScanRun'
import { GetAgentEvents } from '@/agent/application/use-cases/GetAgentEvents'
import { MarkEventAsRead } from '@/agent/application/use-cases/MarkEventAsRead'
import type { RunIncrementalScan } from '@/agent/application/use-cases/RunIncrementalScan'
import type { ScanRunRepository } from '@/agent/domain/repositories/ScanRunRepository'
import { InMemoryAgentEventRepository } from '@/agent/infrastructure/repositories/InMemoryAgentEventRepository'

const T = (iso: string): Date => new Date(iso)

interface Wiring {
  controller: AgentController
  runScan: { execute: ReturnType<typeof vi.fn> }
  scanRepo: ScanRunRepository & {
    findLatest: ReturnType<typeof vi.fn>
    countByStatus: ReturnType<typeof vi.fn>
  }
  eventRepo: InMemoryAgentEventRepository
}

function makeWiring(): Wiring {
  const runScan = {
    execute: vi.fn(async () => ({
      runId: 'run-1',
      status: 'completed' as const,
      companiesScanned: 5,
      clustersGenerated: 2,
      recommendationsGenerated: 10,
      eventsEmitted: 1,
    })),
  }
  const scanRepo = {
    save: vi.fn(),
    findLatest: vi.fn(),
    findLatestCompleted: vi.fn(),
    countByStatus: vi.fn(),
  } as unknown as Wiring['scanRepo']
  const eventRepo = new InMemoryAgentEventRepository()
  const getEvents = new GetAgentEvents(eventRepo)
  const markRead = new MarkEventAsRead(eventRepo)
  const controller = new AgentController(
    runScan as unknown as RunIncrementalScan,
    scanRepo,
    getEvents,
    markRead,
  )
  return { controller, runScan, scanRepo, eventRepo }
}

describe('AgentController', () => {
  let wiring: Wiring

  beforeEach(() => {
    wiring = makeWiring()
  })

  describe('POST /agent/scan', () => {
    it('triggers a manual scan and returns the result', async () => {
      const result = await wiring.controller.triggerScan()

      expect(wiring.runScan.execute).toHaveBeenCalledWith({ trigger: 'manual' })
      expect(result.runId).toBe('run-1')
      expect(result.status).toBe('completed')
    })
  })

  describe('GET /agent/status', () => {
    it('returns latest run plus counts by status', async () => {
      const latest = ScanRun.start({
        id: 'run-1',
        trigger: 'cron',
        now: T('2026-04-26T10:00:00Z'),
      }).complete(
        {
          companiesScanned: 5,
          clustersGenerated: 2,
          recommendationsGenerated: 10,
          eventsEmitted: 1,
        },
        T('2026-04-26T10:01:00Z'),
      )
      wiring.scanRepo.findLatest.mockResolvedValueOnce(latest)
      wiring.scanRepo.countByStatus
        .mockResolvedValueOnce(7) // completed
        .mockResolvedValueOnce(0) // running
        .mockResolvedValueOnce(1) // failed
        .mockResolvedValueOnce(0) // partial

      const status = await wiring.controller.getStatus()

      expect(status.latest).toEqual(
        expect.objectContaining({
          id: 'run-1',
          status: 'completed',
          trigger: 'cron',
          companiesScanned: 5,
          clustersGenerated: 2,
          recommendationsGenerated: 10,
          eventsEmitted: 1,
          durationMs: 60000,
        }),
      )
      expect(status.counts).toEqual({
        completed: 7,
        running: 0,
        failed: 1,
        partial: 0,
      })
    })

    it('returns null latest when no scans exist yet', async () => {
      wiring.scanRepo.findLatest.mockResolvedValueOnce(null)
      wiring.scanRepo.countByStatus.mockResolvedValue(0)

      const status = await wiring.controller.getStatus()

      expect(status.latest).toBeNull()
      expect(status.counts).toEqual({
        completed: 0,
        running: 0,
        failed: 0,
        partial: 0,
      })
    })
  })

  describe('GET /agent/events', () => {
    it('returns events for the company', async () => {
      await wiring.eventRepo.saveAll([
        AgentEvent.create({
          id: 'a',
          companyId: 'c-1',
          eventType: 'new_high_score_match',
          payload: { score: 0.9 },
          now: T('2026-04-26T10:00:00Z'),
        }),
      ])

      const result = await wiring.controller.getEvents(
        'c-1',
        undefined,
        undefined,
      )

      expect(result.events).toHaveLength(1)
      expect(result.events[0]!.id).toBe('a')
    })

    it('forwards unread=true and a numeric limit', async () => {
      await wiring.eventRepo.saveAll([
        AgentEvent.create({
          id: 'a',
          companyId: 'c-1',
          eventType: 'new_high_score_match',
          payload: {},
          now: T('2026-04-26T10:00:00Z'),
        }),
        AgentEvent.create({
          id: 'b',
          companyId: 'c-1',
          eventType: 'new_high_score_match',
          payload: {},
          now: T('2026-04-26T11:00:00Z'),
        }),
      ])

      const result = await wiring.controller.getEvents('c-1', 'true', '1')
      expect(result.events).toHaveLength(1)
      expect(result.events[0]!.id).toBe('b')
    })

    it('treats unread=false (or absent) as showing all events', async () => {
      const read = AgentEvent.create({
        id: 'a',
        companyId: 'c-1',
        eventType: 'new_high_score_match',
        payload: {},
        now: T('2026-04-26T10:00:00Z'),
      }).markAsRead()
      await wiring.eventRepo.saveAll([read])

      const result = await wiring.controller.getEvents(
        'c-1',
        'false',
        undefined,
      )
      expect(result.events).toHaveLength(1)
    })

    it('ignores limit when not a positive integer', async () => {
      await wiring.eventRepo.saveAll([
        AgentEvent.create({
          id: 'a',
          companyId: 'c-1',
          eventType: 'new_high_score_match',
          payload: {},
          now: T('2026-04-26T10:00:00Z'),
        }),
        AgentEvent.create({
          id: 'b',
          companyId: 'c-1',
          eventType: 'new_high_score_match',
          payload: {},
          now: T('2026-04-26T11:00:00Z'),
        }),
      ])

      const result = await wiring.controller.getEvents('c-1', undefined, 'abc')
      expect(result.events).toHaveLength(2)
    })
  })

  describe('POST /agent/events/:id/read', () => {
    it('marks the event as read', async () => {
      await wiring.eventRepo.saveAll([
        AgentEvent.create({
          id: 'a',
          companyId: 'c-1',
          eventType: 'new_high_score_match',
          payload: {},
          now: T('2026-04-26T10:00:00Z'),
        }),
      ])

      await wiring.controller.markEventRead('a')

      const events = await wiring.eventRepo.findByCompany('c-1')
      expect(events[0]!.read).toBe(true)
    })
  })
})
