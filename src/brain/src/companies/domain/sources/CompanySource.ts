import type { Company } from '@/companies/domain/entities/Company'

export const COMPANY_SOURCE = Symbol('COMPANY_SOURCE')

/**
 * PORT — external read-only source of companies.
 *
 * Today implemented by `CsvCompanySource` (mock of the hackathon dataset).
 * When BigQuery credentials arrive, a `BigQueryCompanySource` implements this
 * same interface and only one line in `companies.module.ts` changes. Domain
 * and use cases do not learn about the swap.
 */
export interface CompanySource {
  fetchAll(): Promise<Company[]>
  fetchUpdatedSince(since: Date): Promise<Company[]>
}
