import { Module } from '@nestjs/common'
import { FindCiiuByCode } from './application/use-cases/FindCiiuByCode'
import { CIIU_TAXONOMY_REPOSITORY } from './domain/repositories/CiiuTaxonomyRepository'
import { SupabaseCiiuTaxonomyRepository } from './infrastructure/repositories/SupabaseCiiuTaxonomyRepository'

@Module({
  providers: [
    {
      provide: CIIU_TAXONOMY_REPOSITORY,
      useClass: SupabaseCiiuTaxonomyRepository,
    },
    FindCiiuByCode,
  ],
  exports: [CIIU_TAXONOMY_REPOSITORY, FindCiiuByCode],
})
export class CiiuTaxonomyModule {}
