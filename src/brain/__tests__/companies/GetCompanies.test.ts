import { beforeEach, describe, expect, it } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { GetCompanies } from '@/companies/application/use-cases/GetCompanies'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'

describe('GetCompanies', () => {
  let repo: InMemoryCompanyRepository
  let useCase: GetCompanies

  beforeEach(() => {
    repo = new InMemoryCompanyRepository()
    useCase = new GetCompanies(repo)
  })

  it('returns all companies in the repository', async () => {
    await repo.saveMany([
      Company.create({
        id: '1',
        razonSocial: 'A',
        ciiu: 'G4711',
        municipio: 'BOGOTA',
      }),
      Company.create({
        id: '2',
        razonSocial: 'B',
        ciiu: 'G4711',
        municipio: 'BOGOTA',
      }),
    ])
    const result = await useCase.execute()
    expect(result.companies).toHaveLength(2)
  })

  it('returns an empty list when the repository is empty', async () => {
    const result = await useCase.execute()
    expect(result.companies).toEqual([])
  })
})
