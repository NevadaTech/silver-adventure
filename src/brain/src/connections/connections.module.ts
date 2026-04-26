import { Module } from '@nestjs/common'
import { CompaniesModule } from '@/companies/companies.module'
import { RecommendationsModule } from '@/recommendations/recommendations.module'
import { DeleteConnectionAction } from './application/use-cases/DeleteConnectionAction'
import { GetUserConnections } from './application/use-cases/GetUserConnections'
import { RecordConnectionAction } from './application/use-cases/RecordConnectionAction'
import { CONNECTION_REPOSITORY } from './domain/repositories/ConnectionRepository'
import {
  ConnectionsController,
  UserConnectionsController,
} from './infrastructure/http/connections.controller'
import { SupabaseConnectionRepository } from './infrastructure/repositories/SupabaseConnectionRepository'

@Module({
  imports: [CompaniesModule, RecommendationsModule],
  controllers: [ConnectionsController, UserConnectionsController],
  providers: [
    {
      provide: CONNECTION_REPOSITORY,
      useClass: SupabaseConnectionRepository,
    },
    RecordConnectionAction,
    DeleteConnectionAction,
    GetUserConnections,
  ],
  exports: [
    CONNECTION_REPOSITORY,
    RecordConnectionAction,
    DeleteConnectionAction,
    GetUserConnections,
  ],
})
export class ConnectionsModule {}
