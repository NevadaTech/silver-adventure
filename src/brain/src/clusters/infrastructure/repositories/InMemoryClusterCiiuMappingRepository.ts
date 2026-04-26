import { Injectable } from '@nestjs/common'
import type {
  ClusterCiiuMapping,
  ClusterCiiuMappingRepository,
} from '@/clusters/domain/repositories/ClusterCiiuMappingRepository'

@Injectable()
export class InMemoryClusterCiiuMappingRepository implements ClusterCiiuMappingRepository {
  private readonly store = new Set<string>()

  private key(m: ClusterCiiuMapping): string {
    return `${m.clusterId}::${m.ciiuCode}`
  }

  private parse(key: string): ClusterCiiuMapping {
    const [clusterId, ciiuCode] = key.split('::')
    return { clusterId, ciiuCode }
  }

  async saveMany(mappings: ClusterCiiuMapping[]): Promise<void> {
    for (const m of mappings) {
      this.store.add(this.key(m))
    }
  }

  async findAll(): Promise<ClusterCiiuMapping[]> {
    return Array.from(this.store).map((k) => this.parse(k))
  }

  async getCiiuToClusterMap(): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
    for (const key of this.store) {
      const m = this.parse(key)
      const arr = map.get(m.ciiuCode) ?? []
      arr.push(m.clusterId)
      map.set(m.ciiuCode, arr)
    }
    return map
  }

  async count(): Promise<number> {
    return this.store.size
  }
}
