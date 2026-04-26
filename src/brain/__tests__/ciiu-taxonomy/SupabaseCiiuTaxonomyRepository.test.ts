import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/SupabaseCiiuTaxonomyRepository'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown }

/**
 * Fake PostgrestClient. The real client returns a thenable query builder from
 * `.from(...).select(...)...`. We mimic that by returning `this` from every
 * chainable method and exposing `then` so `await builder` resolves with the
 * value set via `setNext`. Terminal `.maybeSingle()` returns the same value.
 */
function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    then: (onF: (r: Resolved) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of ['from', 'select', 'eq', 'in', 'upsert'] as const) {
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
  code: '4711',
  titulo_actividad:
    'Comercio al por menor en establecimientos no especializados',
  seccion: 'G',
  division: '47',
  grupo: '471',
  titulo_seccion: 'Comercio',
  titulo_division: 'Comercio al por menor',
  titulo_grupo: 'Establecimientos no especializados',
  macro_sector: 'Servicios',
}

describe('SupabaseCiiuTaxonomyRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseCiiuTaxonomyRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseCiiuTaxonomyRepository(fake.db)
  })

  describe('findByCode', () => {
    it('returns a CiiuActivity entity when row exists', async () => {
      fake.setNext({ data: validRow, error: null })
      const activity = await repo.findByCode('4711')
      expect(activity).not.toBeNull()
      expect(activity).toBeInstanceOf(CiiuActivity)
      expect(activity!.code).toBe('4711')
      expect(activity!.tituloSeccion).toBe('Comercio')
      expect(fake.spies.from).toHaveBeenCalledWith('ciiu_taxonomy')
      expect(fake.spies.eq).toHaveBeenCalledWith('code', '4711')
      expect(fake.spies.maybeSingle).toHaveBeenCalledTimes(1)
    })

    it('returns null when no row found', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findByCode('9999')).toBeNull()
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('db down') })
      await expect(repo.findByCode('4711')).rejects.toThrow(/db down/)
    })
  })

  describe('findByCodes', () => {
    it('short-circuits with empty array when no codes given', async () => {
      const result = await repo.findByCodes([])
      expect(result).toEqual([])
      expect(fake.spies.from).not.toHaveBeenCalled()
    })

    it('maps rows to entities', async () => {
      fake.setNext({
        data: [validRow, { ...validRow, code: '4712' }],
        error: null,
      })
      const result = await repo.findByCodes(['4711', '4712'])
      expect(result).toHaveLength(2)
      expect(result.map((a) => a.code)).toEqual(['4711', '4712'])
      expect(fake.spies.in).toHaveBeenCalledWith('code', ['4711', '4712'])
    })

    it('returns empty array when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findByCodes(['4711'])).toEqual([])
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.findByCodes(['4711'])).rejects.toThrow(/boom/)
    })
  })

  describe('findBySection', () => {
    it('queries by seccion and maps results', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findBySection('G')
      expect(result).toHaveLength(1)
      expect(result[0].seccion).toBe('G')
      expect(fake.spies.eq).toHaveBeenCalledWith('seccion', 'G')
    })
  })

  describe('findByDivision', () => {
    it('queries by division', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.findByDivision('47')
      expect(fake.spies.eq).toHaveBeenCalledWith('division', '47')
    })
  })

  describe('findByGrupo', () => {
    it('queries by grupo', async () => {
      fake.setNext({ data: [validRow], error: null })
      await repo.findByGrupo('471')
      expect(fake.spies.eq).toHaveBeenCalledWith('grupo', '471')
    })
  })

  describe('saveAll', () => {
    it('upserts rows mapped from entities with onConflict on code', async () => {
      fake.setNext({ data: null, error: null })
      const a = CiiuActivity.create({
        code: '4711',
        titulo: 'T',
        seccion: 'G',
        division: '47',
        grupo: '471',
        tituloSeccion: 'S',
        tituloDivision: 'D',
        tituloGrupo: 'GR',
        macroSector: 'M',
      })
      await repo.saveAll([a])
      expect(fake.spies.upsert).toHaveBeenCalledTimes(1)
      const [rows, opts] = fake.spies.upsert.mock.calls[0]
      expect(rows).toEqual([
        {
          code: '4711',
          titulo_actividad: 'T',
          seccion: 'G',
          division: '47',
          grupo: '471',
          titulo_seccion: 'S',
          titulo_division: 'D',
          titulo_grupo: 'GR',
          macro_sector: 'M',
        },
      ])
      expect(opts).toEqual({ onConflict: 'code' })
    })

    it('chunks payloads of more than 500 rows into multiple upserts', async () => {
      fake.setNext({ data: null, error: null })
      const activities = Array.from({ length: 1100 }, (_, i) =>
        CiiuActivity.create({
          code: String(1000 + i).padStart(4, '0'),
          titulo: 't',
          seccion: 'G',
          division: '47',
          grupo: '471',
          tituloSeccion: 's',
          tituloDivision: 'd',
          tituloGrupo: 'gr',
        }),
      )
      await repo.saveAll(activities)
      expect(fake.spies.upsert).toHaveBeenCalledTimes(3)
      expect(fake.spies.upsert.mock.calls[0][0]).toHaveLength(500)
      expect(fake.spies.upsert.mock.calls[1][0]).toHaveLength(500)
      expect(fake.spies.upsert.mock.calls[2][0]).toHaveLength(100)
    })

    it('does nothing for empty array', async () => {
      await repo.saveAll([])
      expect(fake.spies.upsert).not.toHaveBeenCalled()
    })

    it('throws on supabase error mid-chunk', async () => {
      fake.setNext({ data: null, error: new Error('insert failed') })
      const a = CiiuActivity.create({
        code: '4711',
        titulo: 'T',
        seccion: 'G',
        division: '47',
        grupo: '471',
        tituloSeccion: 'S',
        tituloDivision: 'D',
        tituloGrupo: 'GR',
      })
      await expect(repo.saveAll([a])).rejects.toThrow(/insert failed/)
    })
  })
})
