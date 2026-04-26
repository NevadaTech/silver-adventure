import { Inject, Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { UseCase } from '@/shared/domain/UseCase'

interface GetCompaniesOutput {
  companies: Company[]
}

@Injectable()
export class GetCompanies implements UseCase<void, GetCompaniesOutput> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly repo: CompanyRepository,
  ) {}

  async execute(): Promise<GetCompaniesOutput> {
    return { companies: await this.repo.findAll() }
  }
}
