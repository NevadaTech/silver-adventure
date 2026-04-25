import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SharedModule } from './shared/shared.module'
import { CiiuTaxonomyModule } from './ciiu-taxonomy/ciiu-taxonomy.module'
import { HealthController } from './shared/infrastructure/health/health.controller'

@Module({
  imports: [ScheduleModule.forRoot(), SharedModule, CiiuTaxonomyModule],
  controllers: [HealthController],
})
export class AppModule {}
