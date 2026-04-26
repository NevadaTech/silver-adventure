import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Cluster } from '@/clusters/domain/entities/Cluster'
import {
  CLUSTER_MEMBERSHIP_REPOSITORY,
  type ClusterMembershipRepository,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'
import {
  CLUSTER_REPOSITORY,
  type ClusterRepository,
} from '@/clusters/domain/repositories/ClusterRepository'
import type { Company } from '@/companies/domain/entities/Company'
import {
  COMPANY_REPOSITORY,
  type CompanyRepository,
} from '@/companies/domain/repositories/CompanyRepository'
import {
  RECOMMENDATION_REPOSITORY,
  type RecommendationRepository,
} from '@/recommendations/domain/repositories/RecommendationRepository'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'
import type { UseCase } from '@/shared/domain/UseCase'

export interface GetClusterMembersInput {
  clusterId: string
  /** Cap on members returned. Default 50. */
  limit?: number
  /**
   * If provided, the response highlights connections OUTGOING from this
   * member (used by the front to render "your value chain inside the cluster").
   */
  perspectiveCompanyId?: string
}

export interface ClusterMemberView {
  id: string
  razonSocial: string
  ciiu: string
  ciiuSeccion: string
  ciiuDivision: string
  municipio: string
  etapa: string
  /** Whether this member matches `perspectiveCompanyId` (rendered as `self`). */
  isSelf: boolean
}

export interface ValueChainEdgeView {
  relationType: RelationType
  count: number
  topTargets: { id: string; razonSocial: string }[]
}

export interface GetClusterMembersResult {
  cluster: {
    id: string
    codigo: string
    titulo: string
    descripcion: string | null
    tipo: string
    ciiuDivision: string | null
    ciiuGrupo: string | null
    municipio: string | null
    etapa: string | null
    memberCount: number
  }
  members: ClusterMemberView[]
  valueChains: ValueChainEdgeView[]
  partial: boolean
}

const DEFAULT_LIMIT = 50
const TOP_TARGETS_PER_CHAIN = 3

@Injectable()
export class GetClusterMembers implements UseCase<
  GetClusterMembersInput,
  GetClusterMembersResult
> {
  constructor(
    @Inject(CLUSTER_REPOSITORY)
    private readonly clusterRepo: ClusterRepository,
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
    @Inject(RECOMMENDATION_REPOSITORY)
    private readonly recRepo: RecommendationRepository,
  ) {}

  async execute(
    input: GetClusterMembersInput,
  ): Promise<GetClusterMembersResult> {
    const cluster = await this.clusterRepo.findById(input.clusterId)
    if (!cluster) {
      throw new NotFoundException(`Cluster ${input.clusterId} not found`)
    }

    const limit = clampLimit(input.limit)
    const memberIds = await this.membershipRepo.findCompanyIdsByCluster(
      cluster.id,
    )
    const members = await this.loadMembers(memberIds, limit)
    const memberIdSet = new Set(memberIds)

    const valueChains = input.perspectiveCompanyId
      ? await this.computeValueChainsFor(
          input.perspectiveCompanyId,
          memberIdSet,
        )
      : []

    return {
      cluster: toClusterView(cluster),
      members: members.map((c) => ({
        id: c.id,
        razonSocial: c.razonSocial,
        ciiu: c.ciiu,
        ciiuSeccion: c.ciiuSeccion,
        ciiuDivision: c.ciiuDivision,
        municipio: c.municipio,
        etapa: c.etapa,
        isSelf: c.id === input.perspectiveCompanyId,
      })),
      valueChains,
      partial: members.length < memberIds.length,
    }
  }

  private async loadMembers(
    memberIds: string[],
    limit: number,
  ): Promise<Company[]> {
    if (memberIds.length === 0) return []
    const sliced = memberIds.slice(0, limit)
    const companies = await Promise.all(
      sliced.map((id) => this.companyRepo.findById(id)),
    )
    return companies.filter((c): c is Company => c !== null)
  }

  private async computeValueChainsFor(
    sourceId: string,
    memberIdSet: Set<string>,
  ): Promise<ValueChainEdgeView[]> {
    const recs = await this.recRepo.findBySource(sourceId)
    if (recs.length === 0) return []

    const inCluster = recs.filter((r) => memberIdSet.has(r.targetCompanyId))
    if (inCluster.length === 0) return []

    const targetIds = Array.from(
      new Set(inCluster.map((r) => r.targetCompanyId)),
    )
    const targets = await Promise.all(
      targetIds.map((id) => this.companyRepo.findById(id)),
    )
    const targetMap = new Map<string, Company>()
    for (const t of targets) {
      if (t) targetMap.set(t.id, t)
    }

    type GroupValue = {
      count: number
      targets: { id: string; razonSocial: string; score: number }[]
    }
    const groups = new Map<RelationType, GroupValue>()
    for (const r of inCluster) {
      const t = targetMap.get(r.targetCompanyId)
      if (!t) continue
      const existing: GroupValue = groups.get(r.relationType) ?? {
        count: 0,
        targets: [],
      }
      existing.count++
      existing.targets.push({
        id: t.id,
        razonSocial: t.razonSocial,
        score: r.score,
      })
      groups.set(r.relationType, existing)
    }

    return Array.from(groups.entries()).map(([relationType, value]) => ({
      relationType,
      count: value.count,
      topTargets: value.targets
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_TARGETS_PER_CHAIN)
        .map(({ id, razonSocial }) => ({ id, razonSocial })),
    }))
  }
}

function toClusterView(c: Cluster): GetClusterMembersResult['cluster'] {
  return {
    id: c.id,
    codigo: c.codigo,
    titulo: c.titulo,
    descripcion: c.descripcion,
    tipo: c.tipo,
    ciiuDivision: c.ciiuDivision,
    ciiuGrupo: c.ciiuGrupo,
    municipio: c.municipio,
    etapa: c.etapa,
    memberCount: c.memberCount,
  }
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT
  return Math.min(raw, 200)
}
