export const CLUSTER_MEMBERSHIP_REPOSITORY = Symbol(
  'CLUSTER_MEMBERSHIP_REPOSITORY',
)

export interface Membership {
  clusterId: string
  companyId: string
}

export interface ClusterMembershipRepository {
  saveMany(memberships: Membership[]): Promise<void>
  findClusterIdsByCompany(companyId: string): Promise<string[]>
  findCompanyIdsByCluster(clusterId: string): Promise<string[]>
  deleteAll(): Promise<void>
  count(): Promise<number>
  /**
   * Returns a Map of `clusterId -> companyIds` for every stored membership.
   * Used by the agent to detect new cluster members between scans.
   */
  snapshot(): Promise<Map<string, string[]>>
}
