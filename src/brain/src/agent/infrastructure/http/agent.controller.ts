// NestJS reads constructor paramtypes via emitDecoratorMetadata at runtime.
// Class deps without @Inject() must keep their value-imports — `import type`
// would erase the binding and break DI.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Controller, Get, Inject, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { GetAgentEvents } from '@/agent/application/use-cases/GetAgentEvents'
import { MarkEventAsRead } from '@/agent/application/use-cases/MarkEventAsRead'
import {
  RunIncrementalScan,
  type ScanRunResult,
} from '@/agent/application/use-cases/RunIncrementalScan'
import type { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import type {
  ScanRunStatus,
  ScanRunTrigger,
} from '@/agent/domain/entities/ScanRun'
import {
  SCAN_RUN_REPOSITORY,
  type ScanRunRepository,
} from '@/agent/domain/repositories/ScanRunRepository'

interface ScanRunView {
  id: string
  status: ScanRunStatus
  trigger: ScanRunTrigger
  startedAt: string
  completedAt: string | null
  companiesScanned: number
  clustersGenerated: number
  recommendationsGenerated: number
  eventsEmitted: number
  durationMs: number | null
  errorMessage: string | null
}

interface AgentStatus {
  latest: ScanRunView | null
  counts: Record<ScanRunStatus, number>
}

interface AgentEventView {
  id: string
  companyId: string
  eventType: string
  payload: Record<string, unknown>
  read: boolean
  createdAt: string
}

function toAgentEventView(event: AgentEvent): AgentEventView {
  return {
    id: event.id,
    companyId: event.companyId,
    eventType: event.eventType,
    payload: event.payload,
    read: event.read,
    createdAt: event.createdAt.toISOString(),
  }
}

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(
    private readonly runScan: RunIncrementalScan,
    @Inject(SCAN_RUN_REPOSITORY)
    private readonly scanRepo: ScanRunRepository,
    private readonly getEventsUseCase: GetAgentEvents,
    private readonly markReadUseCase: MarkEventAsRead,
  ) {}

  @Post('scan')
  @ApiOperation({ summary: 'Trigger a manual incremental scan' })
  async triggerScan(): Promise<ScanRunResult> {
    return this.runScan.execute({ trigger: 'manual' })
  }

  @Get('status')
  @ApiOperation({ summary: 'Latest scan run + count by status' })
  async getStatus(): Promise<AgentStatus> {
    const [latest, completed, running, failed, partial] = await Promise.all([
      this.scanRepo.findLatest(),
      this.scanRepo.countByStatus('completed'),
      this.scanRepo.countByStatus('running'),
      this.scanRepo.countByStatus('failed'),
      this.scanRepo.countByStatus('partial'),
    ])

    return {
      latest: latest
        ? {
            id: latest.id,
            status: latest.status,
            trigger: latest.trigger,
            startedAt: latest.startedAt.toISOString(),
            completedAt: latest.completedAt
              ? latest.completedAt.toISOString()
              : null,
            companiesScanned: latest.companiesScanned,
            clustersGenerated: latest.clustersGenerated,
            recommendationsGenerated: latest.recommendationsGenerated,
            eventsEmitted: latest.eventsEmitted,
            durationMs: latest.durationMs,
            errorMessage: latest.errorMessage,
          }
        : null,
      counts: { completed, running, failed, partial },
    }
  }

  @Get('events')
  @ApiOperation({ summary: 'List agent events for a company' })
  async getEvents(
    @Query('companyId') companyId: string,
    @Query('unread') unread: string | undefined,
    @Query('limit') limit: string | undefined,
  ): Promise<{ events: AgentEventView[] }> {
    const unreadOnly = unread === 'true'
    const parsedLimit = parseLimit(limit)
    const result = await this.getEventsUseCase.execute({
      companyId,
      unreadOnly,
      limit: parsedLimit,
    })
    return { events: result.events.map(toAgentEventView) }
  }

  @Post('events/:id/read')
  @ApiOperation({ summary: 'Mark an agent event as read' })
  async markEventRead(@Param('id') id: string): Promise<void> {
    await this.markReadUseCase.execute({ eventId: id })
  }
}

function parseLimit(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n
}
