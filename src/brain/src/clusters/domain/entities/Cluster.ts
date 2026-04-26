import { Entity } from '@/shared/domain/Entity'
import type { ClusterType } from '@/clusters/domain/value-objects/ClusterType'
import { ETAPAS, type Etapa } from '@/companies/domain/value-objects/Etapa'

interface ClusterProps {
  codigo: string
  titulo: string
  descripcion: string | null
  tipo: ClusterType
  ciiuDivision: string | null
  ciiuGrupo: string | null
  municipio: string | null
  etapa: Etapa | null
  macroSector: string | null
  memberCount: number
}

export interface CreateClusterInput {
  id: string
  codigo: string
  titulo: string
  descripcion?: string | null
  tipo: ClusterType
  ciiuDivision?: string | null
  ciiuGrupo?: string | null
  municipio?: string | null
  etapa?: Etapa | null
  macroSector?: string | null
  memberCount?: number
}

export class Cluster extends Entity<string> {
  private readonly props: ClusterProps

  private constructor(id: string, props: ClusterProps) {
    super(id)
    this.props = Object.freeze(props)
  }

  static create(data: CreateClusterInput): Cluster {
    const id = data.id?.trim() ?? ''
    if (id.length === 0) {
      throw new Error('Cluster.id cannot be empty')
    }
    const codigo = data.codigo?.trim() ?? ''
    if (codigo.length === 0) {
      throw new Error('Cluster.codigo cannot be empty')
    }
    const titulo = data.titulo?.trim() ?? ''
    if (titulo.length === 0) {
      throw new Error('Cluster.titulo cannot be empty')
    }

    const memberCount = data.memberCount ?? 0
    if (memberCount < 0) {
      throw new Error(`Cluster.memberCount must be >= 0, got ${memberCount}`)
    }

    const ciiuDivision = data.ciiuDivision ?? null
    const ciiuGrupo = data.ciiuGrupo ?? null
    const municipio = data.municipio ?? null
    const etapa = data.etapa ?? null

    if (etapa && !ETAPAS.includes(etapa)) {
      throw new Error(`Cluster.etapa must be one of ${ETAPAS.join(', ')}`)
    }

    if (data.tipo === 'heuristic-division') {
      if (!ciiuDivision) {
        throw new Error(
          "Cluster of type 'heuristic-division' requires ciiuDivision",
        )
      }
    }

    if (data.tipo === 'heuristic-grupo') {
      if (!ciiuDivision) {
        throw new Error(
          "Cluster of type 'heuristic-grupo' requires ciiuDivision",
        )
      }
      if (!ciiuGrupo) {
        throw new Error("Cluster of type 'heuristic-grupo' requires ciiuGrupo")
      }
      if (!municipio) {
        throw new Error("Cluster of type 'heuristic-grupo' requires municipio")
      }
      if (!ciiuGrupo.startsWith(ciiuDivision)) {
        throw new Error(
          `Cluster.ciiuGrupo '${ciiuGrupo}' must start with ciiuDivision '${ciiuDivision}'`,
        )
      }
    }

    if (data.tipo === 'heuristic-municipio' && !municipio) {
      throw new Error(
        "Cluster of type 'heuristic-municipio' requires municipio",
      )
    }

    if (data.tipo === 'heuristic-etapa') {
      if (!etapa) {
        throw new Error("Cluster of type 'heuristic-etapa' requires etapa")
      }
      if (!municipio) {
        throw new Error("Cluster of type 'heuristic-etapa' requires municipio")
      }
    }

    if (data.tipo === 'heuristic-hibrido') {
      if (!etapa) {
        throw new Error("Cluster of type 'heuristic-hibrido' requires etapa")
      }
      if (!ciiuDivision) {
        throw new Error(
          "Cluster of type 'heuristic-hibrido' requires ciiuDivision",
        )
      }
      if (!municipio) {
        throw new Error(
          "Cluster of type 'heuristic-hibrido' requires municipio",
        )
      }
    }

    return new Cluster(id, {
      codigo,
      titulo,
      descripcion: data.descripcion ?? null,
      tipo: data.tipo,
      ciiuDivision,
      ciiuGrupo,
      municipio,
      etapa,
      macroSector: data.macroSector ?? null,
      memberCount,
    })
  }

  get codigo(): string {
    return this.props.codigo
  }
  get titulo(): string {
    return this.props.titulo
  }
  get descripcion(): string | null {
    return this.props.descripcion
  }
  get tipo(): ClusterType {
    return this.props.tipo
  }
  get ciiuDivision(): string | null {
    return this.props.ciiuDivision
  }
  get ciiuGrupo(): string | null {
    return this.props.ciiuGrupo
  }
  get municipio(): string | null {
    return this.props.municipio
  }
  get etapa(): Etapa | null {
    return this.props.etapa
  }
  get macroSector(): string | null {
    return this.props.macroSector
  }
  get memberCount(): number {
    return this.props.memberCount
  }
}
