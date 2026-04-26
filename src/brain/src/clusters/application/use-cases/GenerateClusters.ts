import { Inject, Injectable } from '@nestjs/common'
import { HeuristicClusterer } from '@/clusters/application/services/HeuristicClusterer'
import { PredefinedClusterMatcher } from '@/clusters/application/services/PredefinedClusterMatcher'
import { EcosystemDiscoverer } from '@/clusters/application/services/EcosystemDiscoverer'
import { Cluster } from '@/clusters/domain/entities/Cluster'
import {
  CLUSTER_MEMBERSHIP_REPOSITORY,
  type ClusterMembershipRepository,
  type Membership,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'
import {
  CLUSTER_REPOSITORY,
  type ClusterRepository,
} from '@/clusters/domain/repositories/ClusterRepository'
import {
  COMPANY_REPOSITORY,
  type CompanyRepository,
} from '@/companies/domain/repositories/CompanyRepository'
import type { Company } from '@/companies/domain/entities/Company'
import type { UseCase } from '@/shared/domain/UseCase'
import { env } from '@/shared/infrastructure/env'

export interface GenerateClustersResult {
  predefinedClusters: number
  heuristicClusters: number
  ecosystemClusters: number
  totalMemberships: number
}

@Injectable()
export class GenerateClusters implements UseCase<void, GenerateClustersResult> {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepo: CompanyRepository,
    @Inject(CLUSTER_REPOSITORY)
    private readonly clusterRepo: ClusterRepository,
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
    private readonly predefinedMatcher: PredefinedClusterMatcher,
    private readonly heuristicClusterer: HeuristicClusterer,
    private readonly ecosystemDiscoverer: EcosystemDiscoverer,
  ) {}

  async execute(): Promise<GenerateClustersResult> {
    const companies = (await this.companyRepo.findAll()).filter(
      (c) => c.isActive,
    )

    const predefinedAssignments = await this.predefinedMatcher.match(companies)
    const heuristicResults = await this.heuristicClusterer.cluster(companies)

    const ecosystemEnabled = env.AI_DRIVEN_RULES_ENABLED === 'true'
    const ecosystemResults = ecosystemEnabled
      ? await this.ecosystemDiscoverer.discover(companies)
      : []

    // Targeted cleanup of ecosystem clusters before re-persisting (CLU-REQ-NEW-006)
    if (ecosystemEnabled) {
      await this.clusterRepo.deleteByType('heuristic-ecosistema')
    }

    await this.membershipRepo.deleteAll()

    await this.persistPredefinedUpdates(predefinedAssignments)
    await this.persistHeuristicClusters(heuristicResults)
    await this.persistHeuristicClusters(ecosystemResults)

    const memberships: Membership[] = []
    for (const [clusterId, list] of predefinedAssignments) {
      for (const c of list) {
        memberships.push({ clusterId, companyId: c.id })
      }
    }
    for (const { cluster, members } of heuristicResults) {
      for (const c of members) {
        memberships.push({ clusterId: cluster.id, companyId: c.id })
      }
    }
    for (const { cluster, members } of ecosystemResults) {
      for (const c of members) {
        memberships.push({ clusterId: cluster.id, companyId: c.id })
      }
    }
    await this.membershipRepo.saveMany(memberships)

    return {
      predefinedClusters: predefinedAssignments.size,
      heuristicClusters: heuristicResults.length,
      ecosystemClusters: ecosystemResults.length,
      totalMemberships: memberships.length,
    }
  }

  private async persistPredefinedUpdates(
    assignments: Map<string, Company[]>,
  ): Promise<void> {
    const ids = Array.from(assignments.keys())
    if (ids.length === 0) return
    const existing = await this.clusterRepo.findManyByIds(ids)
    const updated = existing.map((c) =>
      Cluster.create({
        id: c.id,
        codigo: c.codigo,
        titulo: c.titulo,
        descripcion: c.descripcion,
        tipo: c.tipo,
        ciiuDivision: c.ciiuDivision,
        ciiuGrupo: c.ciiuGrupo,
        municipio: c.municipio,
        macroSector: c.macroSector,
        memberCount: assignments.get(c.id)!.length,
      }),
    )
    await this.clusterRepo.saveMany(updated)
  }

  private async persistHeuristicClusters(
    results: { cluster: Cluster; members: Company[] }[],
  ): Promise<void> {
    if (results.length === 0) return
    await this.clusterRepo.saveMany(results.map((r) => r.cluster))
  }
}
