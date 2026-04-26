import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import { SupabaseClusterRepository } from '@/clusters/infrastructure/repositories/SupabaseClusterRepository'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

type Resolved = { data: unknown; error: unknown; count?: number | null }

function createFakeDb() {
  let resolved: Resolved = { data: null, error: null }

  const builder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onF: (r: Resolved) => unknown,
      onR?: (e: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(resolved).then(onF, onR),
  }

  for (const fn of [
    'from',
    'select',
    'eq',
    'in',
    'update',
    'upsert',
  ] as const) {
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
  id: 'pred-7',
  codigo: 'LOGISTICA',
  titulo: 'Logística',
  descripcion: 'desc',
  tipo: 'predefined',
  ciiu_division: null,
  ciiu_grupo: null,
  municipio: null,
  macro_sector: null,
  member_count: 12,
}

describe('SupabaseClusterRepository', () => {
  let fake: ReturnType<typeof createFakeDb>
  let repo: SupabaseClusterRepository

  beforeEach(() => {
    fake = createFakeDb()
    repo = new SupabaseClusterRepository(fake.db)
  })

  describe('findAll', () => {
    it('returns Cluster entities mapped from rows', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findAll()
      expect(result).toHaveLength(1)
      expect(result[0]).toBeInstanceOf(Cluster)
      expect(result[0].id).toBe('pred-7')
      expect(fake.spies.from).toHaveBeenCalledWith('clusters')
    })

    it('returns empty array when data is null', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findAll()).toEqual([])
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('boom') })
      await expect(repo.findAll()).rejects.toThrow(/boom/)
    })

    it('throws when row tipo is unknown', async () => {
      fake.setNext({ data: [{ ...validRow, tipo: 'wat' }], error: null })
      await expect(repo.findAll()).rejects.toThrow(/Unknown cluster tipo/)
    })
  })

  describe('findById', () => {
    it('returns a Cluster when row exists', async () => {
      fake.setNext({ data: validRow, error: null })
      const c = await repo.findById('pred-7')
      expect(c).not.toBeNull()
      expect(c!.id).toBe('pred-7')
      expect(fake.spies.eq).toHaveBeenCalledWith('id', 'pred-7')
    })

    it('returns null when no row', async () => {
      fake.setNext({ data: null, error: null })
      expect(await repo.findById('missing')).toBeNull()
    })
  })

  describe('findManyByIds', () => {
    it('queries with .in("id", ids) and maps rows', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findManyByIds(['pred-7', 'pred-8'])
      expect(result).toHaveLength(1)
      expect(fake.spies.in).toHaveBeenCalledWith('id', ['pred-7', 'pred-8'])
    })

    it('returns empty array without querying when ids is empty', async () => {
      const result = await repo.findManyByIds([])
      expect(result).toEqual([])
      expect(fake.spies.from).not.toHaveBeenCalled()
    })
  })

  describe('findByTipo', () => {
    it('queries by tipo and maps rows', async () => {
      fake.setNext({ data: [validRow], error: null })
      const result = await repo.findByTipo('predefined')
      expect(result).toHaveLength(1)
      expect(fake.spies.eq).toHaveBeenCalledWith('tipo', 'predefined')
    })
  })

  describe('findByGrupoAndMunicipio', () => {
    it('returns the heuristic-grupo cluster mapped from the row', async () => {
      const grupoRow = {
        ...validRow,
        id: 'heur-grupo-561-santa-marta',
        codigo: 'H-561-SM',
        titulo: 'Grupo 561 en SANTA MARTA',
        tipo: 'heuristic-grupo',
        ciiu_division: '56',
        ciiu_grupo: '561',
        municipio: 'SANTA MARTA',
      }
      fake.setNext({ data: grupoRow, error: null })
      const result = await repo.findByGrupoAndMunicipio('561', 'SANTA MARTA')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('heur-grupo-561-santa-marta')
      expect(fake.spies.eq).toHaveBeenCalledWith('tipo', 'heuristic-grupo')
      expect(fake.spies.eq).toHaveBeenCalledWith('ciiu_grupo', '561')
      expect(fake.spies.eq).toHaveBeenCalledWith('municipio', 'SANTA MARTA')
    })

    it('returns null when no row matches', async () => {
      fake.setNext({ data: null, error: null })
      expect(
        await repo.findByGrupoAndMunicipio('561', 'SANTA MARTA'),
      ).toBeNull()
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('query boom') })
      await expect(
        repo.findByGrupoAndMunicipio('561', 'SANTA MARTA'),
      ).rejects.toThrow(/query boom/)
    })
  })

  describe('saveMany', () => {
    it('upserts mapped rows with onConflict on id', async () => {
      fake.setNext({ data: null, error: null })
      const c = Cluster.create({
        id: 'pred-7',
        codigo: 'LOGISTICA',
        titulo: 'Logística',
        descripcion: 'desc',
        tipo: 'predefined',
        memberCount: 12,
      })
      await repo.saveMany([c])
      expect(fake.spies.upsert).toHaveBeenCalledTimes(1)
      const [rows, opts] = fake.spies.upsert.mock.calls[0]
      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual({
        id: 'pred-7',
        codigo: 'LOGISTICA',
        titulo: 'Logística',
        descripcion: 'desc',
        tipo: 'predefined',
        ciiu_division: null,
        ciiu_grupo: null,
        municipio: null,
        macro_sector: null,
        member_count: 12,
      })
      expect(opts).toEqual({ onConflict: 'id' })
    })

    it('chunks payloads of more than 500 rows', async () => {
      fake.setNext({ data: null, error: null })
      const clusters = Array.from({ length: 1100 }, (_, i) =>
        Cluster.create({
          id: `pred-${i}`,
          codigo: `c${i}`,
          titulo: `t${i}`,
          tipo: 'predefined',
          memberCount: 0,
        }),
      )
      await repo.saveMany(clusters)
      expect(fake.spies.upsert).toHaveBeenCalledTimes(3)
      expect(fake.spies.upsert.mock.calls[0][0]).toHaveLength(500)
      expect(fake.spies.upsert.mock.calls[1][0]).toHaveLength(500)
      expect(fake.spies.upsert.mock.calls[2][0]).toHaveLength(100)
    })

    it('does nothing for empty array', async () => {
      await repo.saveMany([])
      expect(fake.spies.upsert).not.toHaveBeenCalled()
    })

    it('throws on supabase error', async () => {
      fake.setNext({ data: null, error: new Error('insert failed') })
      const c = Cluster.create({
        id: '1',
        codigo: '1',
        titulo: '1',
        tipo: 'predefined',
      })
      await expect(repo.saveMany([c])).rejects.toThrow(/insert failed/)
    })
  })

  describe('updateDescripcion', () => {
    it('issues an UPDATE with the new descripcion filtered by id', async () => {
      fake.setNext({ data: null, error: null })
      await repo.updateDescripcion('pred-7', 'new desc')
      expect(fake.spies.update).toHaveBeenCalledWith({
        descripcion: 'new desc',
      })
      expect(fake.spies.eq).toHaveBeenCalledWith('id', 'pred-7')
    })

    it('throws when supabase returns error', async () => {
      fake.setNext({ data: null, error: new Error('update failed') })
      await expect(repo.updateDescripcion('pred-7', 'x')).rejects.toThrow(
        /update failed/,
      )
    })
  })

  describe('deleteByType', () => {
    it('issues a DELETE with .eq("tipo", tipo)', async () => {
      const deleteSpy = vi
        .fn()
        .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
      fake.spies.from.mockReturnValueOnce({ delete: deleteSpy })
      await repo.deleteByType('heuristic-ecosistema')
      expect(deleteSpy).toHaveBeenCalledTimes(1)
      const eqSpy = deleteSpy.mock.results[0].value.eq
      expect(eqSpy).toHaveBeenCalledWith('tipo', 'heuristic-ecosistema')
    })

    it('throws when supabase returns error', async () => {
      const deleteSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('delete failed') }),
      })
      fake.spies.from.mockReturnValueOnce({ delete: deleteSpy })
      await expect(repo.deleteByType('heuristic-ecosistema')).rejects.toThrow(
        /delete failed/,
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
  })
})
