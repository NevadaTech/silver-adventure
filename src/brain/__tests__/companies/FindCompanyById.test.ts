import { beforeEach, describe, expect, it } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { FindCompanyById } from '@/companies/application/use-cases/FindCompanyById'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'

describe('FindCompanyById', () => {
  let repo: InMemoryCompanyRepository
  let useCase: FindCompanyById

  beforeEach(() => {
    repo = new InMemoryCompanyRepository()
    useCase = new FindCompanyById(repo)
  })

  it('returns the company when it exists', async () => {
    await repo.saveMany([
      Company.create({
        id: '42',
        razonSocial: 'ACME',
        ciiu: 'G4711',
        municipio: 'BOGOTA',
      }),
    ])
    const result = await useCase.execute({ id: '42' })
    expect(result.company).not.toBeNull()
    expect(result.company!.id).toBe('42')
  })

  it('returns null when the company does not exist', async () => {
    const result = await useCase.execute({ id: 'missing' })
    expect(result.company).toBeNull()
  })
})
