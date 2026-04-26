import { beforeEach, describe, expect, it } from 'vitest'
import {
  Cluster,
  type CreateClusterInput,
} from '@/clusters/domain/entities/Cluster'
import { InMemoryClusterRepository } from '@/clusters/infrastructure/repositories/InMemoryClusterRepository'

function makeCluster(overrides: Partial<CreateClusterInput> = {}): Cluster {
  return Cluster.create({
    id: 'pred-1',
    codigo: 'C1',
    titulo: 'C1',
    tipo: 'predefined',
    memberCount: 0,
    ...overrides,
  })
}

describe('InMemoryClusterRepository', () => {
  let repo: InMemoryClusterRepository

  beforeEach(() => {
    repo = new InMemoryClusterRepository()
  })

  it('saves and retrieves clusters via findAll', async () => {
    await repo.saveMany([makeCluster({ id: '1' }), makeCluster({ id: '2' })])
    const all = await repo.findAll()
    expect(all.map((c) => c.id).sort()).toEqual(['1', '2'])
  })

  it('upserts by id', async () => {
    await repo.saveMany([makeCluster({ id: '1', titulo: 'OLD' })])
    await repo.saveMany([makeCluster({ id: '1', titulo: 'NEW' })])
    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].titulo).toBe('NEW')
  })

  it('findById returns the cluster or null', async () => {
    await repo.saveMany([makeCluster({ id: 'x' })])
    expect((await repo.findById('x'))!.id).toBe('x')
    expect(await repo.findById('missing')).toBeNull()
  })

  it('findManyByIds returns matching clusters in any order', async () => {
    await repo.saveMany([
      makeCluster({ id: 'a' }),
      makeCluster({ id: 'b' }),
      makeCluster({ id: 'c' }),
    ])
    const result = await repo.findManyByIds(['a', 'c'])
    expect(result.map((c) => c.id).sort()).toEqual(['a', 'c'])
  })

  it('findManyByIds returns empty when ids is empty', async () => {
    await repo.saveMany([makeCluster({ id: 'a' })])
    expect(await repo.findManyByIds([])).toEqual([])
  })

  it('findByTipo filters by cluster type', async () => {
    await repo.saveMany([
      makeCluster({ id: 'pred-1', tipo: 'predefined' }),
      makeCluster({
        id: 'div-47-X',
        codigo: '47-X',
        titulo: 'div',
        tipo: 'heuristic-division',
        ciiuDivision: '47',
        municipio: 'X',
      }),
    ])
    const result = await repo.findByTipo('heuristic-division')
    expect(result.map((c) => c.id)).toEqual(['div-47-X'])
  })

  it('updateDescripcion mutates only the descripcion', async () => {
    await repo.saveMany([
      makeCluster({ id: '1', titulo: 'T', descripcion: null }),
    ])
    await repo.updateDescripcion('1', 'new desc')
    const c = await repo.findById('1')
    expect(c!.descripcion).toBe('new desc')
    expect(c!.titulo).toBe('T')
  })

  it('updateDescripcion is a no-op when cluster does not exist', async () => {
    await repo.updateDescripcion('missing', 'foo')
    expect(await repo.count()).toBe(0)
  })

  it('count returns total clusters', async () => {
    expect(await repo.count()).toBe(0)
    await repo.saveMany([makeCluster({ id: '1' }), makeCluster({ id: '2' })])
    expect(await repo.count()).toBe(2)
  })

  describe('deleteByType', () => {
    it('removes all clusters of the given tipo, keeping others', async () => {
      await repo.saveMany([
        makeCluster({
          id: 'eco-ab12ef34-santa-marta',
          codigo: 'eco-ab12ef34-santa-marta',
          titulo: 'Ecosistema 1',
          tipo: 'heuristic-ecosistema',
          municipio: 'Santa Marta',
          ciiuDivision: null,
          ciiuGrupo: null,
        }),
        makeCluster({
          id: 'eco-cd56ef78-bogota',
          codigo: 'eco-cd56ef78-bogota',
          titulo: 'Ecosistema 2',
          tipo: 'heuristic-ecosistema',
          municipio: 'Bogota',
          ciiuDivision: null,
          ciiuGrupo: null,
        }),
        makeCluster({
          id: 'eco-ef90ab12-medellin',
          codigo: 'eco-ef90ab12-medellin',
          titulo: 'Ecosistema 3',
          tipo: 'heuristic-ecosistema',
          municipio: 'Medellin',
          ciiuDivision: null,
          ciiuGrupo: null,
        }),
        makeCluster({ id: 'pred-1', tipo: 'predefined' }),
        makeCluster({ id: 'pred-2', tipo: 'predefined' }),
      ])
      await repo.deleteByType('heuristic-ecosistema')
      const all = await repo.findAll()
      expect(all.map((c) => c.id).sort()).toEqual(['pred-1', 'pred-2'])
    })

    it('is a no-op when no clusters of the given tipo exist', async () => {
      await repo.saveMany([makeCluster({ id: 'pred-1', tipo: 'predefined' })])
      await expect(
        repo.deleteByType('heuristic-ecosistema'),
      ).resolves.not.toThrow()
      expect(await repo.count()).toBe(1)
    })
  })

  describe('findByGrupoAndMunicipio', () => {
    it('returns matching heuristic-grupo cluster', async () => {
      await repo.saveMany([
        makeCluster({
          id: 'heur-grupo-561-santa-marta',
          codigo: 'H-561-SM',
          titulo: 'Grupo 561 en SANTA MARTA',
          tipo: 'heuristic-grupo',
          ciiuDivision: '56',
          ciiuGrupo: '561',
          municipio: 'SANTA MARTA',
        }),
      ])
      const result = await repo.findByGrupoAndMunicipio('561', 'SANTA MARTA')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('heur-grupo-561-santa-marta')
    })

    it('returns null when no cluster matches grupo and municipio', async () => {
      await repo.saveMany([
        makeCluster({
          id: 'heur-grupo-561-cartagena',
          codigo: 'H-561-CTG',
          titulo: 'Grupo 561 en CARTAGENA',
          tipo: 'heuristic-grupo',
          ciiuDivision: '56',
          ciiuGrupo: '561',
          municipio: 'CARTAGENA',
        }),
      ])
      expect(
        await repo.findByGrupoAndMunicipio('561', 'SANTA MARTA'),
      ).toBeNull()
    })

    it('ignores clusters of other tipos', async () => {
      await repo.saveMany([
        makeCluster({
          id: 'pred-1',
          codigo: 'PRED',
          titulo: 'Predefined',
          tipo: 'predefined',
        }),
      ])
      expect(
        await repo.findByGrupoAndMunicipio('561', 'SANTA MARTA'),
      ).toBeNull()
    })
  })
})
