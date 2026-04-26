import { Module } from '@nestjs/common'
import { FindCompanyById } from './application/use-cases/FindCompanyById'
import { GetCompanies } from './application/use-cases/GetCompanies'
import { GetCompaniesUpdatedSince } from './application/use-cases/GetCompaniesUpdatedSince'
import { SyncCompaniesFromSource } from './application/use-cases/SyncCompaniesFromSource'
import { COMPANY_REPOSITORY } from './domain/repositories/CompanyRepository'
import { COMPANY_SOURCE } from './domain/sources/CompanySource'
import { CompaniesController } from './infrastructure/http/companies.controller'
import { SupabaseCompanyRepository } from './infrastructure/repositories/SupabaseCompanyRepository'
import { CsvCompanySource } from './infrastructure/sources/CsvCompanySource'

@Module({
  controllers: [CompaniesController],
  providers: [
    {
      provide: COMPANY_REPOSITORY,
      useClass: SupabaseCompanyRepository,
    },
    {
      // Swap to BigQueryCompanySource when the hackathon credentials arrive.
      provide: COMPANY_SOURCE,
      useClass: CsvCompanySource,
    },
    GetCompanies,
    FindCompanyById,
    GetCompaniesUpdatedSince,
    SyncCompaniesFromSource,
  ],
  exports: [
    COMPANY_REPOSITORY,
    COMPANY_SOURCE,
    GetCompanies,
    FindCompanyById,
    GetCompaniesUpdatedSince,
    SyncCompaniesFromSource,
  ],
})
export class CompaniesModule {}
