import { Inject, Injectable } from '@nestjs/common'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'
import { COMPANY_REPOSITORY } from '@/companies/domain/repositories/CompanyRepository'
import type { CompanySource } from '@/companies/domain/sources/CompanySource'
import { COMPANY_SOURCE } from '@/companies/domain/sources/CompanySource'
import type { UseCase } from '@/shared/domain/UseCase'

interface SyncCompaniesFromSourceInput {
  since?: Date
}

interface SyncCompaniesFromSourceOutput {
  synced: number
}

@Injectable()
export class SyncCompaniesFromSource implements UseCase<
  SyncCompaniesFromSourceInput,
  SyncCompaniesFromSourceOutput
> {
  constructor(
    @Inject(COMPANY_SOURCE) private readonly source: CompanySource,
    @Inject(COMPANY_REPOSITORY) private readonly repo: CompanyRepository,
  ) {}

  async execute(
    input: SyncCompaniesFromSourceInput = {},
  ): Promise<SyncCompaniesFromSourceOutput> {
    const companies = input.since
      ? await this.source.fetchUpdatedSince(input.since)
      : await this.source.fetchAll()

    await this.repo.saveMany(companies)
    return { synced: companies.length }
  }
}
