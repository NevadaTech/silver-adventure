import { Module } from '@nestjs/common'
import { ClustersModule } from '@/clusters/clusters.module'
import { CompaniesModule } from '@/companies/companies.module'
import { RecommendationsModule } from '@/recommendations/recommendations.module'
import { OpportunityDetector } from './application/services/OpportunityDetector'
import { GetAgentEvents } from './application/use-cases/GetAgentEvents'
import { MarkEventAsRead } from './application/use-cases/MarkEventAsRead'
import { RunIncrementalScan } from './application/use-cases/RunIncrementalScan'
import { AGENT_EVENT_REPOSITORY } from './domain/repositories/AgentEventRepository'
import { SCAN_RUN_REPOSITORY } from './domain/repositories/ScanRunRepository'
import { AgentController } from './infrastructure/http/agent.controller'
import { SupabaseAgentEventRepository } from './infrastructure/repositories/SupabaseAgentEventRepository'
import { SupabaseScanRunRepository } from './infrastructure/repositories/SupabaseScanRunRepository'
import { AgentScheduler } from './infrastructure/scheduler/AgentScheduler'

@Module({
  imports: [CompaniesModule, ClustersModule, RecommendationsModule],
  controllers: [AgentController],
  providers: [
    {
      provide: SCAN_RUN_REPOSITORY,
      useClass: SupabaseScanRunRepository,
    },
    {
      provide: AGENT_EVENT_REPOSITORY,
      useClass: SupabaseAgentEventRepository,
    },
    OpportunityDetector,
    RunIncrementalScan,
    GetAgentEvents,
    MarkEventAsRead,
    AgentScheduler,
  ],
  exports: [
    SCAN_RUN_REPOSITORY,
    AGENT_EVENT_REPOSITORY,
    RunIncrementalScan,
    GetAgentEvents,
    MarkEventAsRead,
  ],
})
export class AgentModule {}
