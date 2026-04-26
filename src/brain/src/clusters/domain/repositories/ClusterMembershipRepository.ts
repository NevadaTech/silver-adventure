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
  /**
   * Bulk-delete every membership whose `cluster_id` does NOT start with the
   * given prefix. Used by the agent's regen pass to wipe its own clusters
   * (`pred-`, `div-`, `grp-`, `eta-`, `hib-`) without touching memberships
   * created by other flows (the signup flow tags them with `heur-`).
   */
  deleteAllExceptPrefix(preservePrefix: string): Promise<void>
  count(): Promise<number>
  /**
   * Returns a Map of `clusterId -> companyIds` for every stored membership.
   * Used by the agent to detect new cluster members between scans.
   */
  snapshot(): Promise<Map<string, string[]>>
}
