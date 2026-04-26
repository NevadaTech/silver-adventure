export const CLUSTER_CIIU_MAPPING_REPOSITORY = Symbol(
  'CLUSTER_CIIU_MAPPING_REPOSITORY',
)

export interface ClusterCiiuMapping {
  clusterId: string
  ciiuCode: string
}

export interface ClusterCiiuMappingRepository {
  saveMany(mappings: ClusterCiiuMapping[]): Promise<void>
  findAll(): Promise<ClusterCiiuMapping[]>
  /**
   * Returns a map from CIIU code → list of cluster IDs that include it.
   * Used by PredefinedClusterMatcher to assign companies to predefined clusters.
   */
  getCiiuToClusterMap(): Promise<Map<string, string[]>>
  count(): Promise<number>
}
