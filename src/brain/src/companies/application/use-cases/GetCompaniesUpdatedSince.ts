import { Inject, Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { UseCase } from '@/shared/domain/UseCase'

interface GetCompaniesUpdatedSinceInput {
  since: Date
}

interface GetCompaniesUpdatedSinceOutput {
  companies: Company[]
}

@Injectable()
export class GetCompaniesUpdatedSince implements UseCase<
  GetCompaniesUpdatedSinceInput,
  GetCompaniesUpdatedSinceOutput
> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly repo: CompanyRepository,
  ) {}

  async execute(
    input: GetCompaniesUpdatedSinceInput,
  ): Promise<GetCompaniesUpdatedSinceOutput> {
    return { companies: await this.repo.findUpdatedSince(input.since) }
  }
}
