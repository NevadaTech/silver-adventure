import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { CompaniesController } from '@/companies/infrastructure/http/companies.controller'
import { FindCompanyById } from '@/companies/application/use-cases/FindCompanyById'
import { GetCompanies } from '@/companies/application/use-cases/GetCompanies'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'

function makeCompany(
  id: string,
  overrides: Partial<{ municipio: string }> = {},
) {
  return Company.create({
    id,
    razonSocial: `RS-${id}`,
    ciiu: 'G4711',
    municipio: overrides.municipio ?? 'BOGOTA',
    personal: 5,
    ingresoOperacion: 100_000_000,
    fechaMatricula: new Date('2022-01-01'),
  })
}

describe('CompaniesController', () => {
  let repo: InMemoryCompanyRepository
  let controller: CompaniesController

  beforeEach(() => {
    repo = new InMemoryCompanyRepository()
    const getCompanies = new GetCompanies(repo)
    const findCompanyById = new FindCompanyById(repo)
    controller = new CompaniesController(getCompanies, findCompanyById)
  })

  describe('GET /companies (list)', () => {
    it('returns DTOs for all companies up to default limit of 50', async () => {
      await repo.saveMany(
        Array.from({ length: 60 }, (_, i) => makeCompany(`id-${i}`)),
      )
      const result = await controller.list()
      expect(result).toHaveLength(50)
      expect(result[0]).toHaveProperty('id')
      expect(result[0]).toHaveProperty('razonSocial')
      expect(result[0]).toHaveProperty('ciiu')
      expect(result[0]).toHaveProperty('etapa')
    })

    it('honours custom limit query parameter', async () => {
      await repo.saveMany([
        makeCompany('1'),
        makeCompany('2'),
        makeCompany('3'),
      ])
      const result = await controller.list('2')
      expect(result).toHaveLength(2)
    })

    it('returns the DTO shape with no internal entity leakage', async () => {
      await repo.saveMany([makeCompany('only')])
      const result = await controller.list()
      expect(result[0]).toEqual({
        id: 'only',
        razonSocial: 'RS-only',
        ciiu: '4711',
        ciiuSeccion: 'G',
        ciiuDivision: '47',
        municipio: 'BOGOTA',
        etapa: 'crecimiento',
        personal: 5,
        ingreso: 100_000_000,
      })
    })
  })

  describe('GET /companies/:id', () => {
    it('returns the DTO when the company exists', async () => {
      await repo.saveMany([makeCompany('42')])
      const result = await controller.detail('42')
      expect(result.id).toBe('42')
    })

    it('throws NotFoundException when the company is missing', async () => {
      await expect(controller.detail('missing')).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
