import { Inject, Injectable } from '@nestjs/common'
import {
  CIIU_TAXONOMY_REPOSITORY,
  type CiiuTaxonomyRepository,
} from '@/ciiu-taxonomy/domain/repositories/CiiuTaxonomyRepository'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import type { Company } from '@/companies/domain/entities/Company'

export interface HeuristicClusterResult {
  cluster: Cluster
  members: Company[]
}

@Injectable()
export class HeuristicClusterer {
  private static readonly MIN_DIVISION_SIZE = 5
  private static readonly MIN_GRUPO_SIZE = 10

  constructor(
    @Inject(CIIU_TAXONOMY_REPOSITORY)
    private readonly ciiuRepo: CiiuTaxonomyRepository,
  ) {}

  async cluster(companies: Company[]): Promise<HeuristicClusterResult[]> {
    if (companies.length === 0) return []
    const out: HeuristicClusterResult[] = []

    const divGroups = groupBy(
      companies,
      (c) => `${c.ciiuDivision}|${c.municipio}`,
    )
    const eligibleDivisions = new Set<string>()
    for (const [key, members] of divGroups) {
      if (members.length >= HeuristicClusterer.MIN_DIVISION_SIZE) {
        eligibleDivisions.add(key.split('|')[0])
      }
    }
    const divisionTitles = await this.fetchDivisionTitles(eligibleDivisions)

    for (const [key, members] of divGroups) {
      if (members.length < HeuristicClusterer.MIN_DIVISION_SIZE) continue
      const [div, mun] = key.split('|')
      const titulo = divisionTitles.get(div) ?? `División ${div}`
      out.push({
        cluster: Cluster.create({
          id: `div-${div}-${slug(mun)}`,
          codigo: `${div}-${slug(mun)}`,
          titulo: `${titulo} en ${mun}`,
          descripcion: `Empresas con CIIU división ${div} ubicadas en ${mun}`,
          tipo: 'heuristic-division',
          ciiuDivision: div,
          municipio: mun,
          memberCount: members.length,
        }),
        members,
      })
    }

    const grpGroups = groupBy(
      companies,
      (c) => `${c.ciiuGrupo}|${c.ciiuDivision}|${c.municipio}`,
    )
    const eligibleGrupos = new Set<string>()
    for (const [key, members] of grpGroups) {
      if (members.length >= HeuristicClusterer.MIN_GRUPO_SIZE) {
        eligibleGrupos.add(key.split('|')[0])
      }
    }
    const grupoTitles = await this.fetchGrupoTitles(eligibleGrupos)

    for (const [key, members] of grpGroups) {
      if (members.length < HeuristicClusterer.MIN_GRUPO_SIZE) continue
      const [grp, div, mun] = key.split('|')
      const titulo = grupoTitles.get(grp) ?? `Grupo ${grp}`
      out.push({
        cluster: Cluster.create({
          id: `grp-${grp}-${slug(mun)}`,
          codigo: `${grp}-${slug(mun)}`,
          titulo: `${titulo} en ${mun}`,
          descripcion: `Empresas con CIIU grupo ${grp} ubicadas en ${mun}`,
          tipo: 'heuristic-grupo',
          ciiuDivision: div,
          ciiuGrupo: grp,
          municipio: mun,
          memberCount: members.length,
        }),
        members,
      })
    }

    return out
  }

  private async fetchDivisionTitles(
    divisions: Set<string>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    const batches = await Promise.all(
      Array.from(divisions).map((d) => this.ciiuRepo.findByDivision(d)),
    )
    for (const acts of batches) {
      if (acts.length > 0) result.set(acts[0].division, acts[0].tituloDivision)
    }
    return result
  }

  private async fetchGrupoTitles(
    grupos: Set<string>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    const batches = await Promise.all(
      Array.from(grupos).map((g) => this.ciiuRepo.findByGrupo(g)),
    )
    for (const acts of batches) {
      if (acts.length > 0) result.set(acts[0].grupo, acts[0].tituloGrupo)
    }
    return result
  }
}

function groupBy<T>(items: T[], keyFn: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const arr = map.get(key) ?? []
    arr.push(item)
    map.set(key, arr)
  }
  return map
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
    .toUpperCase()
}
