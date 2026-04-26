import { Controller, Get, NotFoundException, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ExplainCluster } from '@/clusters/application/use-cases/ExplainCluster'
import { GenerateClusters } from '@/clusters/application/use-cases/GenerateClusters'
import {
  CLUSTER_REPOSITORY,
  type ClusterRepository,
} from '@/clusters/domain/repositories/ClusterRepository'
import { Inject } from '@nestjs/common'
import type { Cluster } from '@/clusters/domain/entities/Cluster'

interface ClusterDto {
  id: string
  codigo: string
  titulo: string
  descripcion: string | null
  tipo: string
  ciiuDivision: string | null
  ciiuGrupo: string | null
  municipio: string | null
  memberCount: number
}

@ApiTags('clusters')
@Controller('clusters')
export class ClustersController {
  constructor(
    private readonly generateClusters: GenerateClusters,
    private readonly explainCluster: ExplainCluster,
    @Inject(CLUSTER_REPOSITORY)
    private readonly clusterRepo: ClusterRepository,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Regenerate predefined and heuristic clusters' })
  async generate(): Promise<{
    predefinedClusters: number
    heuristicClusters: number
    totalMemberships: number
  }> {
    return this.generateClusters.execute()
  }

  @Get(':id/explain')
  @ApiOperation({ summary: 'Get a human-readable description of a cluster' })
  async explain(@Param('id') id: string): Promise<{ description: string }> {
    const exists = await this.clusterRepo.findById(id)
    if (!exists) throw new NotFoundException(`Cluster ${id} not found`)
    return this.explainCluster.execute({ clusterId: id })
  }
}

export function toClusterDto(c: Cluster): ClusterDto {
  return {
    id: c.id,
    codigo: c.codigo,
    titulo: c.titulo,
    descripcion: c.descripcion,
    tipo: c.tipo,
    ciiuDivision: c.ciiuDivision,
    ciiuGrupo: c.ciiuGrupo,
    municipio: c.municipio,
    memberCount: c.memberCount,
  }
}
