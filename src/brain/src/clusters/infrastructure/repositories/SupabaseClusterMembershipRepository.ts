import { Inject, Injectable } from '@nestjs/common'
import type {
  ClusterMembershipRepository,
  Membership,
} from '@/clusters/domain/repositories/ClusterMembershipRepository'
import { SUPABASE_CLIENT } from '@/shared/infrastructure/supabase/SupabaseClient'
import type { BrainSupabaseClient } from '@/shared/infrastructure/supabase/SupabaseClient'

const TABLE = 'cluster_members'
const CHUNK_SIZE = 1000

interface MembershipRow {
  cluster_id: string
  company_id: string
}

@Injectable()
export class SupabaseClusterMembershipRepository implements ClusterMembershipRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async saveMany(memberships: Membership[]): Promise<void> {
    if (memberships.length === 0) return
    const rows: MembershipRow[] = memberships.map((m) => ({
      cluster_id: m.clusterId,
      company_id: m.companyId,
    }))
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await this.db
        .from(TABLE)
        .upsert(chunk, { onConflict: 'cluster_id,company_id' })
      if (error) throw error
    }
  }

  async findClusterIdsByCompany(companyId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('cluster_id')
      .eq('company_id', companyId)
    if (error) throw error
    return ((data ?? []) as { cluster_id: string }[]).map((r) => r.cluster_id)
  }

  async findCompanyIdsByCluster(clusterId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('company_id')
      .eq('cluster_id', clusterId)
    if (error) throw error
    return ((data ?? []) as { company_id: string }[]).map((r) => r.company_id)
  }

  async deleteAll(): Promise<void> {
    const { error } = await this.db.from(TABLE).delete().neq('cluster_id', '')
    if (error) throw error
  }

  async count(): Promise<number> {
    const { error, count } = await this.db
      .from(TABLE)
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  }

  async snapshot(): Promise<Map<string, string[]>> {
    const { data, error } = await this.db
      .from(TABLE)
      .select('cluster_id, company_id')
    if (error) throw error
    const result = new Map<string, string[]>()
    for (const row of (data ?? []) as MembershipRow[]) {
      const list = result.get(row.cluster_id)
      if (list) {
        list.push(row.company_id)
      } else {
        result.set(row.cluster_id, [row.company_id])
      }
    }
    return result
  }
}
