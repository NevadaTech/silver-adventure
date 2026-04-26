import { Inject, Injectable } from '@nestjs/common'
import type { Cluster } from '@/clusters/domain/entities/Cluster'
import {
  CLUSTER_MEMBERSHIP_REPOSITORY,
  type ClusterMembershipRepository,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'
import {
  CLUSTER_REPOSITORY,
  type ClusterRepository,
} from '@/clusters/domain/repositories/ClusterRepository'
import type { UseCase } from '@/shared/domain/UseCase'

export interface GetCompanyClustersInput {
  companyId: string
}

export interface GetCompanyClustersOutput {
  clusters: Cluster[]
}

@Injectable()
export class GetCompanyClusters implements UseCase<
  GetCompanyClustersInput,
  GetCompanyClustersOutput
> {
  constructor(
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
    @Inject(CLUSTER_REPOSITORY)
    private readonly clusterRepo: ClusterRepository,
  ) {}

  async execute({
    companyId,
  }: GetCompanyClustersInput): Promise<GetCompanyClustersOutput> {
    const ids = await this.membershipRepo.findClusterIdsByCompany(companyId)
    if (ids.length === 0) return { clusters: [] }
    const clusters = await this.clusterRepo.findManyByIds(ids)
    return { clusters }
  }
}
