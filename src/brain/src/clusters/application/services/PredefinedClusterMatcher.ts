import { Inject, Injectable } from '@nestjs/common'
import {
  CLUSTER_CIIU_MAPPING_REPOSITORY,
  type ClusterCiiuMappingRepository,
} from '@/clusters/domain/repositories/ClusterCiiuMappingRepository'
import type { Company } from '@/companies/domain/entities/Company'

@Injectable()
export class PredefinedClusterMatcher {
  constructor(
    @Inject(CLUSTER_CIIU_MAPPING_REPOSITORY)
    private readonly mappingRepo: ClusterCiiuMappingRepository,
  ) {}

  async match(companies: Company[]): Promise<Map<string, Company[]>> {
    const result = new Map<string, Company[]>()
    if (companies.length === 0) return result

    const ciiuToClusterIds = await this.mappingRepo.getCiiuToClusterMap()
    if (ciiuToClusterIds.size === 0) return result

    for (const c of companies) {
      const clusterIds = ciiuToClusterIds.get(c.ciiu) ?? []
      for (const cid of clusterIds) {
        const arr = result.get(cid) ?? []
        arr.push(c)
        result.set(cid, arr)
      }
    }
    return result
  }
}
