import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ExplainCluster } from '@/clusters/application/use-cases/ExplainCluster'
import { GenerateClusters } from '@/clusters/application/use-cases/GenerateClusters'
import {
  GetClusterMembers,
  type GetClusterMembersResult,
} from '@/clusters/application/use-cases/GetClusterMembers'
import {
  CLUSTER_REPOSITORY,
  type ClusterRepository,
} from '@/clusters/domain/repositories/ClusterRepository'
import type { Cluster } from '@/clusters/domain/entities/Cluster'

export interface ClusterDto {
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
    private readonly getClusterMembers: GetClusterMembers,
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

  @Get(':id/members')
  @ApiOperation({
    summary:
      'List enriched cluster members + value-chain edges for an optional perspective company',
  })
  async members(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('perspectiveCompanyId') perspectiveCompanyId?: string,
  ): Promise<GetClusterMembersResult> {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined
    return this.getClusterMembers.execute({
      clusterId: id,
      limit: parsed,
      perspectiveCompanyId: perspectiveCompanyId?.trim() || undefined,
    })
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
