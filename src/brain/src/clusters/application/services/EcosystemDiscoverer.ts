import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  CIIU_GRAPH_PORT,
  type CiiuGraphPort,
} from '@/recommendations/domain/ports/CiiuGraphPort'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import type { Company } from '@/companies/domain/entities/Company'
import {
  buildEcosystemClusterId,
  labelPropagation,
  slugLower,
  splitIfTooLarge,
} from './LabelPropagation'

export interface EcosystemDiscoveryResult {
  cluster: Cluster
  members: Company[]
}

@Injectable()
export class EcosystemDiscoverer {
  static readonly MIN_SIZE = 3
  static readonly MAX_SIZE = 15
  static readonly MAX_ITERATIONS = 20
  static readonly CONFIDENCE_THRESHOLD = 0.7

  private readonly logger: Logger

  constructor(
    @Inject(CIIU_GRAPH_PORT) private readonly graph: CiiuGraphPort,
    logger?: Logger,
  ) {
    this.logger = logger ?? new Logger(EcosystemDiscoverer.name)
  }

  async discover(companies: Company[]): Promise<EcosystemDiscoveryResult[]> {
    if (companies.length === 0) return []

    const edges = await this.graph.getMatchingPairs(
      EcosystemDiscoverer.CONFIDENCE_THRESHOLD,
    )
    if (edges.length === 0) {
      this.logger.warn(
        '[EcosystemDiscoverer] grafo vacío o sin aristas sobre threshold — sin ecosistemas detectados',
      )
      return []
    }

    const communities = labelPropagation(
      edges,
      EcosystemDiscoverer.MAX_ITERATIONS,
    )
    const filtered = communities.filter(
      (c) => c.length >= EcosystemDiscoverer.MIN_SIZE,
    )
    const split = filtered.flatMap((c) =>
      splitIfTooLarge(c, EcosystemDiscoverer.MAX_SIZE),
    )

    return this.materializeClusters(split, companies)
  }

  private materializeClusters(
    communities: string[][],
    companies: Company[],
  ): EcosystemDiscoveryResult[] {
    const results: EcosystemDiscoveryResult[] = []

    // Build a map from ciiu code → companies
    const byCiiu = new Map<string, Company[]>()
    for (const company of companies) {
      const ciiu = company.ciiu
      if (!byCiiu.has(ciiu)) byCiiu.set(ciiu, [])
      byCiiu.get(ciiu)!.push(company)
    }

    for (const community of communities) {
      const sortedCiius = community.slice().sort()

      // Group companies in this community by municipio
      const membersByMunicipio = new Map<string, Company[]>()
      for (const ciiu of community) {
        const comps = byCiiu.get(ciiu) ?? []
        for (const comp of comps) {
          if (!membersByMunicipio.has(comp.municipio)) {
            membersByMunicipio.set(comp.municipio, [])
          }
          membersByMunicipio.get(comp.municipio)!.push(comp)
        }
      }

      for (const [municipio, members] of membersByMunicipio) {
        if (members.length === 0) continue

        const id = buildEcosystemClusterId(sortedCiius, municipio)
        const ciiusForTitle =
          sortedCiius.length <= 5 ? sortedCiius : sortedCiius.slice(0, 5)
        const ciiusStr =
          ciiusForTitle.join('-') + (sortedCiius.length > 5 ? '...' : '')
        const titulo = `Ecosistema CIIU ${ciiusStr} · ${municipio}`

        const cluster = Cluster.create({
          id,
          codigo: id,
          titulo,
          descripcion: null,
          tipo: 'heuristic-ecosistema',
          ciiuDivision: null,
          ciiuGrupo: null,
          municipio,
          macroSector: null,
          memberCount: members.length,
        })

        results.push({ cluster, members })
      }
    }

    return results
  }
}
