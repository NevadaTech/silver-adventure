import { Module, forwardRef } from '@nestjs/common'
import { CiiuTaxonomyModule } from '@/ciiu-taxonomy/ciiu-taxonomy.module'
import { CompaniesModule } from '@/companies/companies.module'
import { AiMatchEngine } from './application/services/AiMatchEngine'
import { AllianceMatcher } from './application/services/AllianceMatcher'
import { CandidateSelector } from './application/services/CandidateSelector'
import { CiiuPairEvaluator } from './application/services/CiiuPairEvaluator'
import { FeatureVectorBuilder } from './application/services/FeatureVectorBuilder'
import { PeerMatcher } from './application/services/PeerMatcher'
import { ValueChainMatcher } from './application/services/ValueChainMatcher'
import { ExplainRecommendation } from './application/use-cases/ExplainRecommendation'
import { GenerateRecommendations } from './application/use-cases/GenerateRecommendations'
import { GetCompanyRecommendations } from './application/use-cases/GetCompanyRecommendations'
import { GetGroupedCompanyRecommendations } from './application/use-cases/GetGroupedCompanyRecommendations'
import { AI_MATCH_CACHE_REPOSITORY } from './domain/repositories/AiMatchCacheRepository'
import { RECOMMENDATION_REPOSITORY } from './domain/repositories/RecommendationRepository'
import { CompanyRecommendationsController } from './infrastructure/http/company-recommendations.controller'
import { RecommendationsController } from './infrastructure/http/recommendations.controller'
import { SupabaseAiMatchCacheRepository } from './infrastructure/repositories/SupabaseAiMatchCacheRepository'
import { SupabaseRecommendationRepository } from './infrastructure/repositories/SupabaseRecommendationRepository'

@Module({
  imports: [CiiuTaxonomyModule, forwardRef(() => CompaniesModule)],
  controllers: [RecommendationsController, CompanyRecommendationsController],
  providers: [
    {
      provide: RECOMMENDATION_REPOSITORY,
      useClass: SupabaseRecommendationRepository,
    },
    {
      provide: AI_MATCH_CACHE_REPOSITORY,
      useClass: SupabaseAiMatchCacheRepository,
    },
    AiMatchEngine,
    AllianceMatcher,
    CandidateSelector,
    CiiuPairEvaluator,
    FeatureVectorBuilder,
    PeerMatcher,
    ValueChainMatcher,
    GenerateRecommendations,
    GetCompanyRecommendations,
    GetGroupedCompanyRecommendations,
    ExplainRecommendation,
  ],
  exports: [
    RECOMMENDATION_REPOSITORY,
    AI_MATCH_CACHE_REPOSITORY,
    GenerateRecommendations,
    GetCompanyRecommendations,
    GetGroupedCompanyRecommendations,
    ExplainRecommendation,
  ],
})
export class RecommendationsModule {}
