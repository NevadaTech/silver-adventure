import type { Company } from '@/companies/domain/entities/Company'

export const COMPANY_REPOSITORY = Symbol('COMPANY_REPOSITORY')

export interface CompanyRepository {
  findAll(): Promise<Company[]>
  findById(id: string): Promise<Company | null>
  findByCiiuDivision(division: string): Promise<Company[]>
  findByMunicipio(municipio: string): Promise<Company[]>
  findUpdatedSince(timestamp: Date): Promise<Company[]>
  saveMany(companies: Company[]): Promise<void>
  count(): Promise<number>
}
