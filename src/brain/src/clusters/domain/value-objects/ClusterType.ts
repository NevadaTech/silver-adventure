export const CLUSTER_TYPES = [
  'predefined',
  'heuristic-division',
  'heuristic-grupo',
  'heuristic-municipio',
  'heuristic-ecosistema',
] as const

export type ClusterType = (typeof CLUSTER_TYPES)[number]

export function isClusterType(value: string): value is ClusterType {
  return (CLUSTER_TYPES as readonly string[]).includes(value)
}
