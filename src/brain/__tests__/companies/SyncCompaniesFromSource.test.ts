import { beforeEach, describe, expect, it } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import type { CompanySource } from '@/companies/domain/sources/CompanySource'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'
import { SyncCompaniesFromSource } from '@/companies/application/use-cases/SyncCompaniesFromSource'

function makeCompany(id: string) {
  return Company.create({
    id,
    razonSocial: `RS-${id}`,
    ciiu: 'G4711',
    municipio: 'BOGOTA',
  })
}

class StaticCompanySource implements CompanySource {
  constructor(
    private readonly all: Company[],
    private readonly recent: Company[] = all,
  ) {}

  async fetchAll(): Promise<Company[]> {
    return this.all
  }

  async fetchUpdatedSince(_since: Date): Promise<Company[]> {
    return this.recent
  }
}

describe('SyncCompaniesFromSource', () => {
  let repo: InMemoryCompanyRepository

  beforeEach(() => {
    repo = new InMemoryCompanyRepository()
  })

  it('fetches all companies from the source and persists them via the repository', async () => {
    const source = new StaticCompanySource([makeCompany('1'), makeCompany('2')])
    const useCase = new SyncCompaniesFromSource(source, repo)

    const result = await useCase.execute()

    expect(result.synced).toBe(2)
    expect(await repo.count()).toBe(2)
  })

  it('with `since` filter, syncs only companies the source returns from fetchUpdatedSince', async () => {
    const source = new StaticCompanySource(
      [makeCompany('old'), makeCompany('recent')],
      [makeCompany('recent')],
    )
    const useCase = new SyncCompaniesFromSource(source, repo)

    const result = await useCase.execute({
      since: new Date('2026-01-01T00:00:00Z'),
    })

    expect(result.synced).toBe(1)
    expect(await repo.count()).toBe(1)
    expect((await repo.findById('recent'))?.id).toBe('recent')
    expect(await repo.findById('old')).toBeNull()
  })

  it('returns 0 and writes nothing when the source returns empty', async () => {
    const source = new StaticCompanySource([])
    const useCase = new SyncCompaniesFromSource(source, repo)

    const result = await useCase.execute()

    expect(result.synced).toBe(0)
    expect(await repo.count()).toBe(0)
  })
})
