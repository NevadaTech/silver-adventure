/* eslint-disable no-console */
import { CsvCompanySource } from '@/companies/infrastructure/sources/CsvCompanySource'
import { SupabaseCompanyRepository } from '@/companies/infrastructure/repositories/SupabaseCompanyRepository'
import { createBrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

export interface SeedCompaniesResult {
  inserted: number
  repo: SupabaseCompanyRepository
}

export async function seedCompanies(): Promise<SeedCompaniesResult> {
  const source = new CsvCompanySource()
  const companies = await source.fetchAll()

  const repo = new SupabaseCompanyRepository(createBrainSupabaseClient())
  await repo.saveMany(companies)

  return { inserted: companies.length, repo }
}

if (require.main === module) {
  seedCompanies()
    .then(async ({ inserted, repo }) => {
      console.log(`✅ Seeded ${inserted} companies (source: CsvCompanySource)`)
      const total = await repo.count()
      console.log(`🔎 Round-trip OK — companies table count = ${total}`)
      process.exit(inserted > 0 && total >= inserted ? 0 : 1)
    })
    .catch((err) => {
      console.error('❌ Seed companies failed:', err)
      process.exit(1)
    })
}
