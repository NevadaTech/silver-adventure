import { Injectable } from '@nestjs/common'
import type {
  ClusterMembershipRepository,
  Membership,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'

@Injectable()
export class InMemoryClusterMembershipRepository implements ClusterMembershipRepository {
  private readonly store = new Set<string>()

  private key(m: Membership): string {
    return `${m.clusterId}::${m.companyId}`
  }

  private parse(key: string): Membership {
    const [clusterId, companyId] = key.split('::')
    return { clusterId, companyId }
  }

  async saveMany(memberships: Membership[]): Promise<void> {
    for (const m of memberships) {
      this.store.add(this.key(m))
    }
  }

  async findClusterIdsByCompany(companyId: string): Promise<string[]> {
    const result: string[] = []
    for (const key of this.store) {
      const m = this.parse(key)
      if (m.companyId === companyId) result.push(m.clusterId)
    }
    return result
  }

  async findCompanyIdsByCluster(clusterId: string): Promise<string[]> {
    const result: string[] = []
    for (const key of this.store) {
      const m = this.parse(key)
      if (m.clusterId === clusterId) result.push(m.companyId)
    }
    return result
  }

  async deleteAll(): Promise<void> {
    this.store.clear()
  }

  async count(): Promise<number> {
    return this.store.size
  }
}
