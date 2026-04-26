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
})
