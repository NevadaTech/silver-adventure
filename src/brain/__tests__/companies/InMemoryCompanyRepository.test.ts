import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { InMemoryCompanyRepository } from '@/companies/infrastructure/repositories/InMemoryCompanyRepository'

function makeCompany(overrides: Partial<Parameters<typeof Company.create>[0]>) {
  return Company.create({
    id: 'X-1',
    razonSocial: 'ACME',
    ciiu: 'G4711',
    municipio: 'BOGOTA',
    ...overrides,
  })
}

describe('InMemoryCompanyRepository', () => {
  let repo: InMemoryCompanyRepository

  beforeEach(() => {
    repo = new InMemoryCompanyRepository()
  })

  describe('saveMany + findAll', () => {
    it('persists companies and exposes them via findAll', async () => {
      await repo.saveMany([makeCompany({ id: '1' }), makeCompany({ id: '2' })])
      const all = await repo.findAll()
      expect(all).toHaveLength(2)
      expect(all.map((c) => c.id).sort()).toEqual(['1', '2'])
    })

    it('upserts by id (overwrites existing entries)', async () => {
      await repo.saveMany([makeCompany({ id: '1', razonSocial: 'OLD' })])
      await repo.saveMany([makeCompany({ id: '1', razonSocial: 'NEW' })])
      const all = await repo.findAll()
      expect(all).toHaveLength(1)
      expect(all[0].razonSocial).toBe('NEW')
    })

    it('does nothing when given an empty array', async () => {
      await repo.saveMany([])
      expect(await repo.findAll()).toEqual([])
    })
  })

  describe('findById', () => {
    it('returns the company when found', async () => {
      await repo.saveMany([makeCompany({ id: '42' })])
      const c = await repo.findById('42')
      expect(c).not.toBeNull()
      expect(c!.id).toBe('42')
    })

    it('returns null when not found', async () => {
      expect(await repo.findById('missing')).toBeNull()
    })
  })

  describe('findByCiiuDivision', () => {
    it('returns only companies whose ciiuDivision matches', async () => {
      await repo.saveMany([
        makeCompany({ id: '1', ciiu: 'G4711' }),
        makeCompany({ id: '2', ciiu: 'G4790' }),
        makeCompany({ id: '3', ciiu: 'C1011' }),
      ])
      const result = await repo.findByCiiuDivision('47')
      expect(result.map((c) => c.id).sort()).toEqual(['1', '2'])
    })
  })

  describe('findByMunicipio', () => {
    it('returns only companies in the given municipio', async () => {
      await repo.saveMany([
        makeCompany({ id: '1', municipio: 'BOGOTA' }),
        makeCompany({ id: '2', municipio: 'MEDELLIN' }),
        makeCompany({ id: '3', municipio: 'BOGOTA' }),
      ])
      const result = await repo.findByMunicipio('BOGOTA')
      expect(result.map((c) => c.id).sort()).toEqual(['1', '3'])
    })
  })

  describe('findUpdatedSince', () => {
    it('returns only companies whose updatedAt is strictly greater than the cutoff', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      await repo.saveMany([makeCompany({ id: 'old' })])

      vi.setSystemTime(new Date('2026-04-01T00:00:00Z'))
      await repo.saveMany([makeCompany({ id: 'recent' })])

      const result = await repo.findUpdatedSince(
        new Date('2026-02-01T00:00:00Z'),
      )
      expect(result.map((c) => c.id)).toEqual(['recent'])
      vi.useRealTimers()
    })

    it('updates the timestamp when a company is re-saved', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      await repo.saveMany([makeCompany({ id: '1' })])

      vi.setSystemTime(new Date('2026-04-01T00:00:00Z'))
      await repo.saveMany([makeCompany({ id: '1', razonSocial: 'NEW' })])

      const result = await repo.findUpdatedSince(
        new Date('2026-02-01T00:00:00Z'),
      )
      expect(result.map((c) => c.id)).toEqual(['1'])
      vi.useRealTimers()
    })
  })

  describe('count', () => {
    it('returns the number of stored companies', async () => {
      expect(await repo.count()).toBe(0)
      await repo.saveMany([makeCompany({ id: '1' }), makeCompany({ id: '2' })])
      expect(await repo.count()).toBe(2)
    })
  })
})
