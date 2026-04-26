import { beforeEach, describe, expect, it } from 'vitest'
import { CiiuActivity } from '@/ciiu-taxonomy/domain/entities/CiiuActivity'
import { InMemoryCiiuTaxonomyRepository } from '@/ciiu-taxonomy/infrastructure/repositories/InMemoryCiiuTaxonomyRepository'
import { HeuristicClusterer } from '@/clusters/application/services/HeuristicClusterer'
import { Company } from '@/companies/domain/entities/Company'

interface RepeatSpec {
  idPrefix: string
  ciiu: string
  municipio: string
}

function repeat(count: number, spec: RepeatSpec): Company[] {
  return Array.from({ length: count }, (_, i) =>
    Company.create({
      id: `${spec.idPrefix}-${i}`,
      razonSocial: 'X',
      ciiu: spec.ciiu,
      municipio: spec.municipio,
    }),
  )
}

async function seedTaxonomy(): Promise<InMemoryCiiuTaxonomyRepository> {
  const repo = new InMemoryCiiuTaxonomyRepository()
  await repo.saveAll([
    CiiuActivity.create({
      code: '4711',
      titulo: 'Tiendas de víveres',
      seccion: 'G',
      division: '47',
      grupo: '471',
      tituloSeccion: 'Comercio',
      tituloDivision: 'Comercio al por menor',
      tituloGrupo: 'Comercio en establecimientos no especializados',
    }),
    CiiuActivity.create({
      code: '4771',
      titulo: 'Comercio de prendas de vestir',
      seccion: 'G',
      division: '47',
      grupo: '477',
      tituloSeccion: 'Comercio',
      tituloDivision: 'Comercio al por menor',
      tituloGrupo: 'Comercio especializado de productos',
    }),
    CiiuActivity.create({
      code: '4761',
      titulo: 'Comercio de libros',
      seccion: 'G',
      division: '47',
      grupo: '476',
      tituloSeccion: 'Comercio',
      tituloDivision: 'Comercio al por menor',
      tituloGrupo: 'Comercio cultural',
    }),
    CiiuActivity.create({
      code: '4721',
      titulo: 'Comercio de alimentos',
      seccion: 'G',
      division: '47',
      grupo: '472',
      tituloSeccion: 'Comercio',
      tituloDivision: 'Comercio al por menor',
      tituloGrupo: 'Comercio de alimentos',
    }),
    CiiuActivity.create({
      code: '4921',
      titulo: 'Transporte terrestre',
      seccion: 'H',
      division: '49',
      grupo: '492',
      tituloSeccion: 'Transporte',
      tituloDivision: 'Transporte terrestre',
      tituloGrupo: 'Transporte de pasajeros',
    }),
    CiiuActivity.create({
      code: '5611',
      titulo: 'Restaurantes',
      seccion: 'I',
      division: '56',
      grupo: '561',
      tituloSeccion: 'Alojamiento y comidas',
      tituloDivision: 'Servicio de comidas',
      tituloGrupo: 'Restaurantes',
    }),
  ])
  return repo
}

describe('HeuristicClusterer', () => {
  let ciiuRepo: InMemoryCiiuTaxonomyRepository
  let clusterer: HeuristicClusterer

  beforeEach(async () => {
    ciiuRepo = await seedTaxonomy()
    clusterer = new HeuristicClusterer(ciiuRepo)
  })

  it('PASE 1: groups by (ciiu_division, municipio) when group >= 5', async () => {
    const companies = [
      ...repeat(6, {
        idPrefix: 'sm-47',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
      }),
      ...repeat(3, {
        idPrefix: 'sm-49',
        ciiu: 'H4921',
        municipio: 'SANTA MARTA',
      }),
      ...repeat(5, { idPrefix: 'cn-56', ciiu: 'I5611', municipio: 'CIENAGA' }),
    ]
    const result = await clusterer.cluster(companies)
    const divClusters = result.filter(
      (r) => r.cluster.tipo === 'heuristic-division',
    )
    expect(divClusters).toHaveLength(2)

    const ids = divClusters.map((c) => c.cluster.id).sort()
    expect(ids).toEqual(['div-47-SANTA_MARTA', 'div-56-CIENAGA'])

    const sm47 = divClusters.find((c) => c.cluster.id === 'div-47-SANTA_MARTA')!
    expect(sm47.cluster.titulo).toContain('Comercio al por menor')
    expect(sm47.cluster.titulo).toContain('SANTA MARTA')
    expect(sm47.cluster.memberCount).toBe(6)
    expect(sm47.members).toHaveLength(6)
  })

  it('PASE 2: groups by (ciiu_grupo, municipio) when group >= 10', async () => {
    const companies = [
      ...repeat(12, {
        idPrefix: 'sm-477',
        ciiu: 'G4771',
        municipio: 'SANTA MARTA',
      }),
      ...repeat(8, {
        idPrefix: 'sm-476',
        ciiu: 'G4761',
        municipio: 'SANTA MARTA',
      }),
    ]
    const result = await clusterer.cluster(companies)
    const grupoClusters = result.filter(
      (r) => r.cluster.tipo === 'heuristic-grupo',
    )
    expect(grupoClusters).toHaveLength(1)
    expect(grupoClusters[0].cluster.id).toBe('grp-477-SANTA_MARTA')
    expect(grupoClusters[0].cluster.titulo).toContain(
      'Comercio especializado de productos',
    )
  })

  it('CASCADA: empresa pertenece a cluster división Y a cluster grupo cuando ambos califican', async () => {
    const companies = repeat(12, {
      idPrefix: 'sm-477',
      ciiu: 'G4771',
      municipio: 'SANTA MARTA',
    })
    const result = await clusterer.cluster(companies)

    const div = result.find((r) => r.cluster.tipo === 'heuristic-division')!
    const grp = result.find((r) => r.cluster.tipo === 'heuristic-grupo')!
    expect(div).toBeDefined()
    expect(grp).toBeDefined()
    expect(div.members).toHaveLength(12)
    expect(grp.members).toHaveLength(12)
    expect(grp.members.every((m) => div.members.includes(m))).toBe(true)
  })

  it('ORTOGONAL: división califica pero ningún grupo individual llega a 10 → solo cluster división', async () => {
    const companies = [
      ...repeat(6, {
        idPrefix: 'sm-471',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
      }),
      ...repeat(4, {
        idPrefix: 'sm-472',
        ciiu: 'G4721',
        municipio: 'SANTA MARTA',
      }),
    ]
    const result = await clusterer.cluster(companies)
    expect(
      result.filter((r) => r.cluster.tipo === 'heuristic-division'),
    ).toHaveLength(1)
    expect(
      result.filter((r) => r.cluster.tipo === 'heuristic-grupo'),
    ).toHaveLength(0)
  })

  it('division below threshold (<5) is excluded entirely', async () => {
    const companies = repeat(4, {
      idPrefix: 'sm-47',
      ciiu: 'G4711',
      municipio: 'SANTA MARTA',
    })
    const result = await clusterer.cluster(companies)
    expect(result).toEqual([])
  })

  it('returns empty array for empty input', async () => {
    expect(await clusterer.cluster([])).toEqual([])
  })

  it('slugifies municipios with spaces and accents in cluster ids', async () => {
    const companies = repeat(5, {
      idPrefix: 'bog-47',
      ciiu: 'G4711',
      municipio: 'BOGOTÁ DC',
    })
    const result = await clusterer.cluster(companies)
    expect(result).toHaveLength(1)
    expect(result[0].cluster.id).toBe('div-47-BOGOTA_DC')
    expect(result[0].cluster.codigo).toBe('47-BOGOTA_DC')
    expect(result[0].cluster.municipio).toBe('BOGOTÁ DC')
  })

  describe('PASE 3 — Etapa', () => {
    it('creates a heuristic-etapa cluster when 8+ companies share (etapa, municipio)', async () => {
      const companies = repeat(9, {
        idPrefix: 'etapa-mix',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
      })
      const result = await clusterer.cluster(companies)
      const etapaClusters = result.filter(
        (r) => r.cluster.tipo === 'heuristic-etapa',
      )
      expect(etapaClusters).toHaveLength(1)
      const c = etapaClusters[0].cluster
      expect(c.id.startsWith('eta-')).toBe(true)
      expect(c.id).toContain('SANTA_MARTA')
      expect(c.etapa).toBe(companies[0].etapa)
      expect(c.municipio).toBe('SANTA MARTA')
    })

    it('does not create heuristic-etapa when fewer than 8 companies share etapa+municipio', async () => {
      const companies = repeat(7, {
        idPrefix: 'few',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
      })
      const result = await clusterer.cluster(companies)
      expect(
        result.filter((r) => r.cluster.tipo === 'heuristic-etapa'),
      ).toHaveLength(0)
    })
  })

  describe('PASE 4 — Híbrido', () => {
    it('creates a heuristic-hibrido when 6+ share (etapa, division, municipio) AND division qualified', async () => {
      const companies = repeat(8, {
        idPrefix: 'hib',
        ciiu: 'G4711',
        municipio: 'SANTA MARTA',
      })
      const result = await clusterer.cluster(companies)
      const hibClusters = result.filter(
        (r) => r.cluster.tipo === 'heuristic-hibrido',
      )
      expect(hibClusters).toHaveLength(1)
      const c = hibClusters[0].cluster
      expect(c.id.startsWith('hib-')).toBe(true)
      expect(c.ciiuDivision).toBe('47')
      expect(c.etapa).toBeTruthy()
      expect(c.municipio).toBe('SANTA MARTA')
    })

    it('skips heuristic-hibrido when the underlying division did NOT qualify (<5)', async () => {
      const companies = repeat(4, {
        idPrefix: 'small-div',
        ciiu: 'G4711',
        municipio: 'CIENAGA',
      })
      const result = await clusterer.cluster(companies)
      expect(
        result.filter((r) => r.cluster.tipo === 'heuristic-hibrido'),
      ).toHaveLength(0)
    })

    it('skips heuristic-hibrido when the hybrid cohort has fewer than 6 companies', async () => {
      const companies = [
        ...repeat(5, {
          idPrefix: 'div-only',
          ciiu: 'G4711',
          municipio: 'SANTA MARTA',
        }),
      ]
      const result = await clusterer.cluster(companies)
      // The (etapa, division, municipio) cohort is the same 5 → < MIN_HYBRID_SIZE (6)
      expect(
        result.filter((r) => r.cluster.tipo === 'heuristic-hibrido'),
      ).toHaveLength(0)
    })
  })

  it('falls back to a default title when CIIU taxonomy is missing the division', async () => {
    const emptyRepo = new InMemoryCiiuTaxonomyRepository()
    const c = new HeuristicClusterer(emptyRepo)
    const companies = repeat(5, {
      idPrefix: 'x-47',
      ciiu: 'G4711',
      municipio: 'SANTA MARTA',
    })
    const result = await c.cluster(companies)
    expect(result[0].cluster.titulo).toContain('División 47')
  })
})
