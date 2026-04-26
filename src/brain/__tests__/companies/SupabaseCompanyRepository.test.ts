import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Company } from '@/companies/domain/entities/Company'
import { SupabaseCompanyRepository } from '@/companies/infrastructure/repositories/SupabaseCompanyRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gt: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of ['from', 'select', 'eq', 'in', 'gt', 'upsert'] as const) {
    builder[fn].mockReturnValue(builder)
  }
  builder.maybeSingle.mockImplementation(() => Promise.resolve(resolved))

  return {
    db: builder as unknown as BrainSupabaseClient,
    setNext: (value: Resolved) => {
      resolved = value
    },
    spies: builder,
  }
}

const validRow = {
  id: '0123456-7',
  razon_social: 'EMPRESA TEST S.A.S',
  ciiu: '4711',
  ciiu_seccion: 'G',
  ciiu_division: '47',
  ciiu_grupo: '471',
  municipio: 'SANTA MARTA',
  tipo_organizacion: 'SOCIEDAD',
  personal: 5,
  ingreso_operacion: 100_000_000,
  activos_totales: 200_000_000,
  email: 'test@example.com',
  telefono: '3001234567',
  direccion: 'Calle 1',
  fecha_matricula: '2022-01-01',
  fecha_renovacion: '2026-01-01',
  estado: 'ACTIVO',
  etapa: 'crecimiento',
}

describe('SupabaseCompanyRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseCompanyRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseCompanyRepository(fake.db)
  })

  describe('findAll', () => {
    it('returns Company entities mapped from rows', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findAll()
      expect(result).toHaveLength(1)
      expect(result[0]).toBeInstanceOf(Company)
      expect(result[0].id).toBe('0123456-7')
      expect(fake.spies.from).toHaveBeenCalledWith('companies')
    })

    it('returns empty array when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findAll()).toEqual([])
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.findAll()).rejects.toThrow(/boom/)
    })
  })

  describe('findById', () => {
    it('returns a Company when row exists', async () => {
      fake.setNext({ data: validRow, error: null })
      const c = await repo.findById('0123456-7')
      expect(c).not.toBeNull()
      expect(c!.id).toBe('0123456-7')
      expect(fake.spies.eq).toHaveBeenCalledWith('id', '0123456-7')
      expect(fake.spies.maybeSingle).toHaveBeenCalledTimes(1)
    })

    it('returns null when no row', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findById('missing')).toBeNull()
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('db down') })
      await expect(repo.findById('x')).rejects.toThrow(/db down/)
    })
  })

  describe('findByCiiuDivision', () => {
    it('queries by ciiu_division and maps rows', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findByCiiuDivision('47')
      expect(result).toHaveLength(1)
      expect(fake.spies.eq).toHaveBeenCalledWith('ciiu_division', '47')
    })
  })

  describe('findByMunicipio', () => {
    it('queries by municipio and maps rows', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findByMunicipio('SANTA MARTA')
      expect(result).toHaveLength(1)
      expect(fake.spies.eq).toHaveBeenCalledWith('municipio', 'SANTA MARTA')
    })
  })

  describe('findUpdatedSince', () => {
    it('queries by updated_at > since (ISO string)', async () => {
      fake.setNext({ data: [validRow], error: null })
      const since = new Date('2026-01-01T00:00:00Z')
      await repo.findUpdatedSince(since)
      expect(fake.spies.gt).toHaveBeenCalledWith(
        'updated_at',
        since.toISOString(),
      )
    })
  })

  describe('count', () => {
    it('returns the count from the head request', async () => {
      fake.setNext({ data: null, error: null, count: 42 })
      const total = await repo.count()
      expect(total).toBe(42)
      expect(fake.spies.select).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      })
    })

    it('returns 0 when count is null', async () => {
      fake.setNext({ data: null, error: null, count: null })
      expect(await repo.count()).toBe(0)
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('count failed') })
      await expect(repo.count()).rejects.toThrow(/count failed/)
    })
  })

  describe('saveMany', () => {
    it('upserts mapped rows with onConflict on id', async () => {
      fake.setNext({ data: null, error: null })
      const c = Company.create({
        id: '0123456-7',
        razonSocial: 'EMPRESA TEST S.A.S',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
        tipoOrganizacion: 'SOCIEDAD',
        personal: 5,
        ingresoOperacion: 100_000_000,
        activosTotales: 200_000_000,
        email: 'test@example.com',
        telefono: '3001234567',
        direccion: 'Calle 1',
        fechaMatricula: new Date('2022-01-01'),
        fechaRenovacion: new Date('2026-01-01'),
        estado: 'ACTIVO',
      })
      await repo.saveMany([c])
      expect(fake.spies.upsert).toHaveBeenCalledTimes(1)
      const [rows, opts] = fake.spies.upsert.mock.calls[0]
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe('0123456-7')
      expect(rows[0].razon_social).toBe('EMPRESA TEST S.A.S')
      expect(rows[0].ciiu).toBe('4711')
      expect(rows[0].ciiu_seccion).toBe('G')
      expect(rows[0].ciiu_division).toBe('47')
      expect(rows[0].ciiu_grupo).toBe('471')
      expect(rows[0].fecha_matricula).toBe('2022-01-01')
      expect(rows[0].fecha_renovacion).toBe('2026-01-01')
      expect(rows[0].etapa).toBe('crecimiento')
      expect(opts).toEqual({ onConflict: 'id' })
    })

    it('chunks payloads of more than 500 rows', async () => {
      fake.setNext({ data: null, error: null })
      const companies = Array.from({ length: 1100 }, (_, i) =>
        Company.create({
          id: `id-${i}`,
          razonSocial: 'X',
          ciiu: 'A0111',
          municipio: 'BOGOTA',
        }),
      )
      await repo.saveMany(companies)
      expect(fake.spies.upsert).toHaveBeenCalledTimes(3)
      expect(fake.spies.upsert.mock.calls[0][0]).toHaveLength(500)
      expect(fake.spies.upsert.mock.calls[1][0]).toHaveLength(500)
      expect(fake.spies.upsert.mock.calls[2][0]).toHaveLength(100)
    })

    it('does nothing for empty array', async () => {
      await repo.saveMany([])
      expect(fake.spies.upsert).not.toHaveBeenCalled()
    })

    it('throws on supabase error mid-chunk', async () => {
      fake.setNext({ data: null, error: new Error('insert failed') })
      const c = Company.create({
        id: '1',
        razonSocial: 'X',
        ciiu: 'A0111',
        municipio: 'BOGOTA',
      })
      await expect(repo.saveMany([c])).rejects.toThrow(/insert failed/)
    })

    it('serialises null date fields as null', async () => {
      fake.setNext({ data: null, error: null })
      const c = Company.create({
        id: '1',
        razonSocial: 'X',
        ciiu: 'A0111',
        municipio: 'BOGOTA',
      })
      await repo.saveMany([c])
      const [rows] = fake.spies.upsert.mock.calls[0]
      expect(rows[0].fecha_matricula).toBeNull()
      expect(rows[0].fecha_renovacion).toBeNull()
    })
  })

  describe('row mapping', () => {
    it('parses date strings from rows into Date objects', async () => {
      fake.setNext({ data: validRow, error: null })
      const c = await repo.findById('0123456-7')
      expect(c!.fechaMatricula).toEqual(new Date('2022-01-01'))
      expect(c!.fechaRenovacion).toEqual(new Date('2026-01-01'))
    })

    it('maps null date columns to null', async () => {
      fake.setNext({
        data: { ...validRow, fecha_matricula: null, fecha_renovacion: null },
        error: null,
      })
      const c = await repo.findById('x')
      expect(c!.fechaMatricula).toBeNull()
      expect(c!.fechaRenovacion).toBeNull()
    })
  })
})
