import { Module } from '@nestjs/common'
import { FindCompanyById } from './application/use-cases/FindCompanyById'
import { GetCompanies } from './application/use-cases/GetCompanies'
import { GetCompaniesUpdatedSince } from './application/use-cases/GetCompaniesUpdatedSince'
import { COMPANY_REPOSITORY } from './domain/repositories/CompanyRepository'
import { CompaniesController } from './infrastructure/http/companies.controller'
import { SupabaseCompanyRepository } from './infrastructure/repositories/SupabaseCompanyRepository'

@Module({
  controllers: [CompaniesController],
  providers: [
    {
      provide: COMPANY_REPOSITORY,
      useClass: SupabaseCompanyRepository,
    },
    GetCompanies,
    FindCompanyById,
    GetCompaniesUpdatedSince,
  ],
  exports: [
    COMPANY_REPOSITORY,
    GetCompanies,
    FindCompanyById,
    GetCompaniesUpdatedSince,
  ],
})
export class CompaniesModule {}
