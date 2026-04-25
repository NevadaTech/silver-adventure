import { Inject, Injectable } from '@nestjs/common'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import {
  CIIU_TAXONOMY_REPOSITORY,
  CiiuTaxonomyRepository,
} from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import { UseCase } from '@/shared/domain/UseCase'

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
