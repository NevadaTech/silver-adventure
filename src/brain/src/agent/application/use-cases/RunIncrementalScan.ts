// NestJS reads constructor paramtypes via emitDecoratorMetadata at runtime.
// Class deps without @Inject() must keep their value-imports — `import type`
// would erase the binding and break DI.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { Inject, Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { OpportunityDetector } from '@/agent/application/services/OpportunityDetector'
import { AgentEvent } from '@/agent/domain/entities/AgentEvent'
import {
  ScanRun,
  type ScanRunStatus,
  type ScanRunTrigger,
} from '@/agent/domain/entities/ScanRun'
import {
  AGENT_EVENT_REPOSITORY,
  type AgentEventRepository,
} from '@/agent/domain/repositories/AgentEventRepository'
import {
  SCAN_RUN_REPOSITORY,
  type ScanRunRepository,
} from '@/agent/domain/repositories/ScanRunRepository'
import {
  CLUSTER_MEMBERSHIP_REPOSITORY,
  type ClusterMembershipRepository,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'
import { GenerateClusters } from '@/clusters/application/use-cases/GenerateClusters'
import {
  COMPANY_REPOSITORY,
  type CompanyRepository,
} from '@/companies/domain/repositories/CompanyRepository'
import type { Etapa } from '@/companies/domain/value-objects/Etapa'
import { SyncCompaniesFromSource } from '@/companies/application/use-cases/SyncCompaniesFromSource'
import { GenerateRecommendations } from '@/recommendations/application/use-cases/GenerateRecommendations'
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '@/recommendations/domain/repositories/RecommendationRepository'
import type { UseCase } from '@/shared/domain/UseCase'
import { serializeError } from '@/shared/infrastructure/errors/serializeError'

export interface RunIncrementalScanInput {
  trigger: ScanRunTrigger
}

export interface ScanRunResult {
  runId: string
  status: ScanRunStatus
  companiesScanned: number
  clustersGenerated: number
  recommendationsGenerated: number
  eventsEmitted: number
}

@Injectable()
export class RunIncrementalScan implements UseCase<
  RunIncrementalScanInput,
  ScanRunResult
> {
  private readonly logger = new Logger(RunIncrementalScan.name)

  constructor(
    @Inject(SCAN_RUN_REPOSITORY)
    private readonly scanRepo: ScanRunRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
    private readonly syncCompanies: SyncCompaniesFromSource,
    private readonly generateClusters: GenerateClusters,
    private readonly generateRecs: GenerateRecommendations,
    private readonly detector: OpportunityDetector,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
    @Inject(AGENT_EVENT_REPOSITORY)
    private readonly eventRepo: AgentEventRepository,
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
  ) {}

  async execute(input: RunIncrementalScanInput): Promise<ScanRunResult> {
    const id = randomUUID()
    let run = ScanRun.start({ id, trigger: input.trigger, now: new Date() })
    await this.scanRepo.save(run)

    try {
      const last = await this.scanRepo.findLatestCompleted()
      const since = last?.completedAt ?? new Date(0)

      // Snapshot etapas BEFORE the sync so we can diff against the new
      // state once the source has applied incremental changes.
      const previousEtapas = await this.snapshotEtapas()

      await this.syncCompanies.execute({ since })

      const updated = await this.companyRepo.findUpdatedSince(since)

      if (updated.length === 0 && last !== null) {
        run = run.complete(
          {
            companiesScanned: 0,
            clustersGenerated: 0,
            recommendationsGenerated: 0,
            eventsEmitted: 0,
          },
          new Date(),
        )
        await this.scanRepo.save(run)
        return {
          runId: id,
          status: 'completed',
          companiesScanned: 0,
          clustersGenerated: 0,
          recommendationsGenerated: 0,
          eventsEmitted: 0,
        }
      }

      const previousRecKeys = await this.recRepo.snapshotKeys()
      const previousMemberships = await this.membershipRepo.snapshot()

      const clusterStats = await this.generateClusters.execute()
      const recStats = await this.generateRecs.execute({})

      const newRecs = await this.recRepo.findAll()
      const newMemberships = await this.membershipRepo.snapshot()
      const newClusterMemberships = diffMemberships(
        newMemberships,
        previousMemberships,
      )

      const now = new Date()
      const events = this.detector.detect({
        newRecs,
        previousRecKeys,
        newClusterMemberships,
        existingClusterMemberships: previousMemberships,
        now,
      })

      const etapaEvents = await this.detectEtapaChanges(previousEtapas, now)
      events.push(...etapaEvents)

      await this.eventRepo.saveAll(events)

      const clustersGenerated =
        clusterStats.predefinedClusters + clusterStats.heuristicClusters

      run = run.complete(
        {
          companiesScanned: updated.length,
          clustersGenerated,
          recommendationsGenerated: recStats.totalRecommendations,
          eventsEmitted: events.length,
        },
        new Date(),
      )
      await this.scanRepo.save(run)

      return {
        runId: id,
        status: 'completed',
        companiesScanned: updated.length,
        clustersGenerated,
        recommendationsGenerated: recStats.totalRecommendations,
        eventsEmitted: events.length,
      }
    } catch (e) {
      const message = serializeError(e)
      run = run.fail(message, new Date())
      await this.scanRepo.save(run)
      this.logger.error(`Scan ${id} failed: ${message}`)
      throw e
    }
  }

  private async snapshotEtapas(): Promise<Map<string, Etapa>> {
    const all = await this.companyRepo.findAll()
    const map = new Map<string, Etapa>()
    for (const company of all) {
      map.set(company.id, company.etapa)
    }
    return map
  }

  private async detectEtapaChanges(
    previous: Map<string, Etapa>,
    now: Date,
  ): Promise<AgentEvent[]> {
    if (previous.size === 0) return []
    const current = await this.companyRepo.findAll()
    const events: AgentEvent[] = []
    for (const company of current) {
      const before = previous.get(company.id)
      if (!before) continue
      if (before === company.etapa) continue
      events.push(
        AgentEvent.create({
          id: randomUUID(),
          companyId: company.id,
          eventType: 'etapa_changed',
          payload: {
            from: before,
            to: company.etapa,
            razonSocial: company.razonSocial,
          },
          now,
        }),
      )
    }
    return events
  }
}

function diffMemberships(
  next: Map<string, string[]>,
  prev: Map<string, string[]>,
): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const [clusterId, members] of next) {
    const prevMembers = new Set(prev.get(clusterId) ?? [])
    const newOnes = members.filter((m) => !prevMembers.has(m))
    if (newOnes.length > 0) {
      result.set(clusterId, newOnes)
    }
  }
  return result
}
