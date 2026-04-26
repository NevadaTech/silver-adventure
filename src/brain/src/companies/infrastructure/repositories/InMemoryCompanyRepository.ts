import { Injectable } from '@nestjs/common'
import type { Company } from '@/companies/domain/entities/Company'
import type { CompanyRepository } from '@/companies/domain/repositories/CompanyRepository'

interface Entry {
  company: Company
  updatedAt: Date
}

@Injectable()
export class InMemoryCompanyRepository implements CompanyRepository {
  private readonly store = new Map<string, Entry>()

  async findAll(): Promise<Company[]> {
    return Array.from(this.store.values()).map((e) => e.company)
  }

  async findById(id: string): Promise<Company | null> {
    return this.store.get(id)?.company ?? null
  }

  async findByCiiuDivision(division: string): Promise<Company[]> {
    return (await this.findAll()).filter((c) => c.ciiuDivision === division)
  }

  async findByMunicipio(municipio: string): Promise<Company[]> {
    return (await this.findAll()).filter((c) => c.municipio === municipio)
  }

  async findUpdatedSince(timestamp: Date): Promise<Company[]> {
    return Array.from(this.store.values())
      .filter((e) => e.updatedAt > timestamp)
      .map((e) => e.company)
  }

  async saveMany(companies: Company[]): Promise<void> {
    const now = new Date()
    for (const company of companies) {
      this.store.set(company.id, { company, updatedAt: now })
    }
  }

  async count(): Promise<number> {
    return this.store.size
  }
}
