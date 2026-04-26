import { Inject, Injectable } from '@nestjs/common'
import type {
  ClusterCiiuMapping,
  ClusterCiiuMappingRepository,
} from '@/clusters/domain/repositories/ClusterCiiuMappingRepository'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'cluster_ciiu_mapping'
const CHUNK_SIZE = 1000

interface MappingRow {
  cluster_id: string
  ciiu_code: string
}

@Injectable()
export class SupabaseClusterCiiuMappingRepository implements ClusterCiiuMappingRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async saveMany(mappings: ClusterCiiuMapping[]): Promise<void> {
    if (mappings.length === 0) return
    const rows: MappingRow[] = mappings.map((m) => ({
      cluster_id: m.clusterId,
      ciiu_code: m.ciiuCode,
    }))
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await this.db
        .from(TABLE)
        .upsert(chunk, { onConflict: 'cluster_id,ciiu_code' })
      if (error) throw error
    }
  }

  async findAll(): Promise<ClusterCiiuMapping[]> {
    const { data, error } = await this.db.from(TABLE).select('*')
    if (error) throw error
    return ((data ?? []) as MappingRow[]).map((r) => ({
      clusterId: r.cluster_id,
      ciiuCode: r.ciiu_code,
    }))
  }

  async getCiiuToClusterMap(): Promise<Map<string, string[]>> {
    const all = await this.findAll()
    const map = new Map<string, string[]>()
    for (const m of all) {
      const arr = map.get(m.ciiuCode) ?? []
      arr.push(m.clusterId)
      map.set(m.ciiuCode, arr)
    }
    return map
  }

  async count(): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  }
}
