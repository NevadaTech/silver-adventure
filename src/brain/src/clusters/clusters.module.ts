import { Module, forwardRef } from '@nestjs/common'
import { CompaniesModule } from '@/companies/companies.module'
import { RecommendationsModule } from '@/recommendations/recommendations.module'
import { EcosystemDiscoverer } from './application/services/EcosystemDiscoverer'
import { ExplainCluster } from './application/use-cases/ExplainCluster'
import { GenerateClusters } from './application/use-cases/GenerateClusters'
import { GetCompanyClusters } from './application/use-cases/GetCompanyClusters'
import { HeuristicClusterer } from './application/services/HeuristicClusterer'
import { PredefinedClusterMatcher } from './application/services/PredefinedClusterMatcher'
import { CLUSTER_CIIU_MAPPING_REPOSITORY } from './domain/repositories/ClusterCiiuMappingRepository'
import { CLUSTER_MEMBERSHIP_REPOSITORY } from './domain/repositories/ClusterMembershipRepository'
import { CLUSTER_REPOSITORY } from './domain/repositories/ClusterRepository'
import { ClustersController } from './infrastructure/http/clusters.controller'
import { CompanyClustersController } from './infrastructure/http/company-clusters.controller'
import { SupabaseClusterCiiuMappingRepository } from './infrastructure/repositories/SupabaseClusterCiiuMappingRepository'
import { SupabaseClusterMembershipRepository } from './infrastructure/repositories/SupabaseClusterMembershipRepository'
import { SupabaseClusterRepository } from './infrastructure/repositories/SupabaseClusterRepository'
import { CiiuTaxonomyModule } from '@/ciiu-taxonomy/ciiu-taxonomy.module'

@Module({
  imports: [
    CiiuTaxonomyModule,
    forwardRef(() => CompaniesModule),
    RecommendationsModule,
  ],
  controllers: [ClustersController, CompanyClustersController],
  providers: [
    {
      provide: CLUSTER_REPOSITORY,
      useClass: SupabaseClusterRepository,
    },
    {
      provide: CLUSTER_MEMBERSHIP_REPOSITORY,
      useClass: SupabaseClusterMembershipRepository,
    },
    {
      provide: CLUSTER_CIIU_MAPPING_REPOSITORY,
      useClass: SupabaseClusterCiiuMappingRepository,
    },
    EcosystemDiscoverer,
    HeuristicClusterer,
    PredefinedClusterMatcher,
    GenerateClusters,
    GetCompanyClusters,
    ExplainCluster,
  ],
  exports: [
    CLUSTER_REPOSITORY,
    CLUSTER_MEMBERSHIP_REPOSITORY,
    CLUSTER_CIIU_MAPPING_REPOSITORY,
    GenerateClusters,
    GetCompanyClusters,
    ExplainCluster,
  ],
})
export class ClustersModule {}
