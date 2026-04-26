import { Inject, Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { UseCase } from '@/shared/domain/UseCase'

interface FindCompanyByIdInput {
  id: string
}

interface FindCompanyByIdOutput {
  company: Company | null
}

@Injectable()
export class FindCompanyById implements UseCase<
  FindCompanyByIdInput,
  FindCompanyByIdOutput
> {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly repo: CompanyRepository,
  ) {}

  async execute(input: FindCompanyByIdInput): Promise<FindCompanyByIdOutput> {
    return { company: await this.repo.findById(input.id) }
  }
}
