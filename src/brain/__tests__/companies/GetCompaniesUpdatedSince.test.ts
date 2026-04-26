import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { GetCompaniesUpdatedSince } from '@/companies/application/use-cases/GetCompaniesUpdatedSince'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'

function makeCompany(id: string) {
  return Company.create({
    id,
    razonSocial: 'X',
    ciiu: 'G4711',
    municipio: 'BOGOTA',
  })
}

describe('GetCompaniesUpdatedSince', () => {
  let repo: InMemoryCompanyRepository
  let useCase: GetCompaniesUpdatedSince

  beforeEach(() => {
    repo = new InMemoryCompanyRepository()
    useCase = new GetCompaniesUpdatedSince(repo)
  })

  it('returns only companies whose updatedAt is strictly greater than the cutoff', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await repo.saveMany([makeCompany('old')])

    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'))
    await repo.saveMany([makeCompany('recent-1'), makeCompany('recent-2')])

    const result = await useCase.execute({
      since: new Date('2026-02-01T00:00:00Z'),
    })
    expect(result.companies.map((c) => c.id).sort()).toEqual([
      'recent-1',
      'recent-2',
    ])
    vi.useRealTimers()
  })

  it('returns empty when nothing has been updated since the cutoff', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    await repo.saveMany([makeCompany('only')])
    const result = await useCase.execute({
      since: new Date('2026-04-01T00:00:00Z'),
    })
    expect(result.companies).toEqual([])
    vi.useRealTimers()
  })
})
