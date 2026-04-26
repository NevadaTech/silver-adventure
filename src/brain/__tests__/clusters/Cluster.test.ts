import { describe, expect, it } from 'vitest'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import {
  CLUSTER_TYPES,
  isClusterType,
} from '@/clusters/domain/value-objects/ClusterType'

describe('ClusterType', () => {
  it('exposes the 4 valid types', () => {
    expect(CLUSTER_TYPES).toEqual([
      'predefined',
      'heuristic-division',
      'heuristic-grupo',
      'heuristic-municipio',
    ])
  })

  it('isClusterType narrows valid values', () => {
    expect(isClusterType('predefined')).toBe(true)
    expect(isClusterType('heuristic-grupo')).toBe(true)
    expect(isClusterType('foo')).toBe(false)
  })
})

describe('Cluster', () => {
  const baseValid = {
    id: 'pred-7',
    codigo: 'LOGISTICA',
    titulo: 'Logística',
    descripcion: 'Cluster predefinido de logística',
    tipo: 'predefined' as const,
    memberCount: 12,
  }

  it('creates a predefined cluster without geographic/CIIU fields', () => {
    const c = Cluster.create(baseValid)
    expect(c.id).toBe('pred-7')
    expect(c.tipo).toBe('predefined')
    expect(c.titulo).toBe('Logística')
    expect(c.ciiuDivision).toBeNull()
    expect(c.ciiuGrupo).toBeNull()
    expect(c.municipio).toBeNull()
    expect(c.memberCount).toBe(12)
  })

  it('throws when titulo is empty', () => {
    expect(() => Cluster.create({ ...baseValid, titulo: '' })).toThrow()
  })

  it('throws when titulo is whitespace only', () => {
    expect(() => Cluster.create({ ...baseValid, titulo: '   ' })).toThrow()
  })

  it('throws when id is empty', () => {
    expect(() => Cluster.create({ ...baseValid, id: '' })).toThrow()
  })

  it('throws when codigo is empty', () => {
    expect(() => Cluster.create({ ...baseValid, codigo: '' })).toThrow()
  })

  it('throws when memberCount is negative', () => {
    expect(() => Cluster.create({ ...baseValid, memberCount: -1 })).toThrow()
  })

  it('defaults memberCount to 0 when not provided', () => {
    const { memberCount: _omit, ...rest } = baseValid
    const c = Cluster.create(rest)
    expect(c.memberCount).toBe(0)
  })

  describe('heuristic-division', () => {
    it('creates with ciiuDivision + municipio', () => {
      const c = Cluster.create({
        id: 'div-47-SANTA_MARTA',
        codigo: '47-SANTA_MARTA',
        titulo: 'Comercio al por menor en SANTA MARTA',
        descripcion: 'Empresas con CIIU división 47 en SANTA MARTA',
        tipo: 'heuristic-division',
        ciiuDivision: '47',
        municipio: 'SANTA MARTA',
        memberCount: 6,
      })
      expect(c.tipo).toBe('heuristic-division')
      expect(c.ciiuDivision).toBe('47')
      expect(c.municipio).toBe('SANTA MARTA')
    })

    it('throws when ciiuDivision is missing', () => {
      expect(() =>
        Cluster.create({
          id: 'div-47-X',
          codigo: '47-X',
          titulo: 'X',
          descripcion: null,
          tipo: 'heuristic-division',
          municipio: 'SANTA MARTA',
          memberCount: 6,
        }),
      ).toThrow(/ciiuDivision/i)
    })
  })

  describe('heuristic-grupo', () => {
    it('creates with ciiuDivision + ciiuGrupo + municipio', () => {
      const c = Cluster.create({
        id: 'grp-477-SANTA_MARTA',
        codigo: '477-SANTA_MARTA',
        titulo: 'Comercio de productos farmacéuticos en SANTA MARTA',
        descripcion: null,
        tipo: 'heuristic-grupo',
        ciiuDivision: '47',
        ciiuGrupo: '477',
        municipio: 'SANTA MARTA',
        memberCount: 12,
      })
      expect(c.ciiuGrupo).toBe('477')
    })

    it('throws when ciiuGrupo is missing', () => {
      expect(() =>
        Cluster.create({
          id: 'grp-477-X',
          codigo: '477-X',
          titulo: 'X',
          descripcion: null,
          tipo: 'heuristic-grupo',
          ciiuDivision: '47',
          municipio: 'SANTA MARTA',
          memberCount: 10,
        }),
      ).toThrow(/ciiuGrupo/i)
    })

    it('throws when ciiuDivision is missing', () => {
      expect(() =>
        Cluster.create({
          id: 'grp-477-X',
          codigo: '477-X',
          titulo: 'X',
          descripcion: null,
          tipo: 'heuristic-grupo',
          ciiuGrupo: '477',
          municipio: 'SANTA MARTA',
          memberCount: 10,
        }),
      ).toThrow(/ciiuDivision/i)
    })

    it('throws when ciiuGrupo does not start with ciiuDivision digits', () => {
      expect(() =>
        Cluster.create({
          id: 'grp-477-X',
          codigo: '477-X',
          titulo: 'X',
          descripcion: null,
          tipo: 'heuristic-grupo',
          ciiuDivision: '48',
          ciiuGrupo: '477',
          municipio: 'SANTA MARTA',
          memberCount: 10,
        }),
      ).toThrow(/grupo.*division/i)
    })

    it('throws when municipio is missing', () => {
      expect(() =>
        Cluster.create({
          id: 'grp-477-X',
          codigo: '477-X',
          titulo: 'X',
          descripcion: null,
          tipo: 'heuristic-grupo',
          ciiuDivision: '47',
          ciiuGrupo: '477',
          memberCount: 10,
        }),
      ).toThrow(/municipio/i)
    })
  })

  describe('heuristic-municipio', () => {
    it('creates with municipio only', () => {
      const c = Cluster.create({
        id: 'mun-SANTA_MARTA',
        codigo: 'SANTA_MARTA',
        titulo: 'Empresas en SANTA MARTA',
        descripcion: null,
        tipo: 'heuristic-municipio',
        municipio: 'SANTA MARTA',
        memberCount: 50,
      })
      expect(c.tipo).toBe('heuristic-municipio')
      expect(c.municipio).toBe('SANTA MARTA')
    })

    it('throws when municipio is missing', () => {
      expect(() =>
        Cluster.create({
          id: 'mun-X',
          codigo: 'X',
          titulo: 'X',
          descripcion: null,
          tipo: 'heuristic-municipio',
          memberCount: 10,
        }),
      ).toThrow(/municipio/i)
    })
  })

  it('exposes macroSector and descripcion via getters', () => {
    const c = Cluster.create({
      ...baseValid,
      descripcion: 'desc',
      macroSector: 'COMERCIO',
    })
    expect(c.descripcion).toBe('desc')
    expect(c.macroSector).toBe('COMERCIO')
  })

  it('defaults macroSector and descripcion to null', () => {
    const c = Cluster.create(baseValid)
    expect(c.descripcion).toBe('Cluster predefinido de logística')
    const c2 = Cluster.create({ ...baseValid, descripcion: null })
    expect(c2.descripcion).toBeNull()
    expect(c2.macroSector).toBeNull()
  })

  it('trims id, codigo, titulo', () => {
    const c = Cluster.create({
      ...baseValid,
      id: '  pred-7  ',
      codigo: '  LOGISTICA  ',
      titulo: '  Logística  ',
    })
    expect(c.id).toBe('pred-7')
    expect(c.codigo).toBe('LOGISTICA')
    expect(c.titulo).toBe('Logística')
  })
})
