import { Module, forwardRef } from '@nestjs/common'
import { CiiuTaxonomyModule } from '@/ciiu-taxonomy/ciiu-taxonomy.module'
import { ClustersModule } from '@/clusters/clusters.module'
import { RecommendationsModule } from '@/recommendations/recommendations.module'
import { ClassifyCompanyFromDescription } from './application/use-cases/ClassifyCompanyFromDescription'
import { FindCompanyById } from './application/use-cases/FindCompanyById'
import { GetCompanies } from './application/use-cases/GetCompanies'
import { GetCompaniesUpdatedSince } from './application/use-cases/GetCompaniesUpdatedSince'
import { OnboardCompanyFromSignup } from './application/use-cases/OnboardCompanyFromSignup'
import { SyncCompaniesFromSource } from './application/use-cases/SyncCompaniesFromSource'
import { COMPANY_REPOSITORY } from './domain/repositories/CompanyRepository'
import { COMPANY_SOURCE } from './domain/sources/CompanySource'
import { CompaniesController } from './infrastructure/http/companies.controller'
import { CompanyOnboardingController } from './infrastructure/http/company-onboarding.controller'
import { SupabaseCompanyRepository } from './infrastructure/repositories/SupabaseCompanyRepository'
import { CsvCompanySource } from './infrastructure/sources/CsvCompanySource'

@Module({
  imports: [
    CiiuTaxonomyModule,
    forwardRef(() => ClustersModule),
    forwardRef(() => RecommendationsModule),
  ],
  controllers: [CompaniesController, CompanyOnboardingController],
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
    ClassifyCompanyFromDescription,
    OnboardCompanyFromSignup,
  ],
  exports: [
    COMPANY_REPOSITORY,
    COMPANY_SOURCE,
    GetCompanies,
    FindCompanyById,
    GetCompaniesUpdatedSince,
    SyncCompaniesFromSource,
    ClassifyCompanyFromDescription,
    OnboardCompanyFromSignup,
  ],
})
export class CompaniesModule {}
