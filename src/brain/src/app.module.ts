import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SharedModule } from './shared/shared.module'
import { HealthController } from './shared/infrastructure/health/health.controller'

@Module({
  imports: [ScheduleModule.forRoot(), SharedModule],
  controllers: [HealthController],
})
export class AppModule {}
