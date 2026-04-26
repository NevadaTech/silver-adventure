import { Inject, Injectable } from '@nestjs/common'
import type { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import type { CiiuTaxonomyRepository } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import { CIIU_TAXONOMY_REPOSITORY } from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import type { UseCase } from '@/shared/domain/UseCase'

interface FindCiiuByCodeInput {
  code: string
}

interface FindCiiuByCodeOutput {
  activity: CiiuActivity | null
}

@Injectable()
export class FindCiiuByCode implements UseCase<
  FindCiiuByCodeInput,
  FindCiiuByCodeOutput
> {
  constructor(
    @Inject(CIIU_TAXONOMY_REPOSITORY)
    private readonly repo: CiiuTaxonomyRepository,
  ) {}

  async execute(input: FindCiiuByCodeInput): Promise<FindCiiuByCodeOutput> {
    return { activity: await this.repo.findByCode(input.code) }
  }
}
