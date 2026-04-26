import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SharedModule } from './shared/shared.module'
import { CiiuTaxonomyModule } from './ciiu-taxonomy/ciiu-taxonomy.module'
import { ClustersModule } from './clusters/clusters.module'
import { CompaniesModule } from './companies/companies.module'
import { RecommendationsModule } from './recommendations/recommendations.module'
import { HealthController } from './shared/infrastructure/health/health.controller'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SharedModule,
    CiiuTaxonomyModule,
    CompaniesModule,
    ClustersModule,
    RecommendationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
