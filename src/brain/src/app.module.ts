import { Module } from '@nestjs/common'
import { HealthController } from './shared/infrastructure/health/health.controller'

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
